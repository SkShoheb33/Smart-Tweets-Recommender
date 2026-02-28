import os
import json
import re
import asyncio
from typing import Any, Dict, List
from dotenv import load_dotenv
from pydantic import BaseModel, Field

# ADK Import
from google.adk.agents import Agent
from google.adk.runners import InMemoryRunner

from tweets_recommender.api.getBookMarks import get_twitter_bookmarks
from tweets_recommender.api.getTweets import make_home_timeline_request

load_dotenv()

class RecommendedTweet(BaseModel):
    entryId: str = Field(description="The ID of the candidate tweet")
    tweet: str = Field(description="The text content of the tweet")
    link: str = Field(description="The URL link to the tweet")
    score: int = Field(description="Relevance score from 1 to 10")
    reasoning: str = Field(description="A 1-sentence reasoning for why this tweet was recommended based on the user's bookmarks")

class Recommendations(BaseModel):
    recommendations: List[RecommendedTweet] = Field(description="List of top recommended tweets")

def run_agent(config: Dict[str, Any] = None):
    if config is None:
        config = {}

    def fetch_bookmarks_tool() -> str:
        """Fetches the user's bookmarks from Twitter."""
        print("--- Fetching Bookmarks ---")
        try:
            bookmarks = get_twitter_bookmarks(config)
            print(f"Loaded {len(bookmarks)} bookmarks.")
            return json.dumps(bookmarks[:50]) # limit to avoid token overflow
        except Exception as e:
            return json.dumps({"error": str(e)})

    def fetch_timeline_tool() -> str:
        """Fetches candidate tweets from the user's home timeline."""
        print("--- Fetching Candidate Tweets ---")
        try:
            tweets = make_home_timeline_request(config)
            print(f"Loaded {len(tweets)} timeline tweets.")
            return json.dumps(tweets[:50])
        except Exception as e:
            return json.dumps({"error": str(e)})

    agent = Agent(
        model='gemini-2.5-flash',
        name='bookmark_recommender',
        description="Recommends tweets from the user's home timeline based on their bookmarks.",
        instruction=f"""
            You are a helpful agent that curates a personalized Twitter feed.
            Your goal is to recommend tweets to the user based on their bookmarks.

            Step 1. Use the 'fetch_bookmarks_tool' to get the user's bookmarked tweets.
            Step 2. Analyze the bookmarked tweets to create a detailed profile of the user's interests, preferred topics, and tone.
            Step 3. Use the 'fetch_timeline_tool' to get the latest tweets from the user's timeline.
            Step 4. Evaluate each timeline tweet against the user profile. Score each tweet's relevance to the user from 1 to 10, and provide a 1-sentence reasoning. Be lenient, if a tweet even tangentially relates to the user's interests, give it a score of 5 or higher.
            Step 5. Select the top 10 recommended tweets, and return them.
        """,
        tools=[fetch_bookmarks_tool, fetch_timeline_tool],
        output_schema=Recommendations
    )

    print("\nStarting ADK Agent Execution...")
    
    async def execute_agent():
        runner = InMemoryRunner(agent=agent)
        events = await runner.run_debug(
            "Please fetch my bookmarks, fetch my timeline, score the tweets and return the top recommendations in JSON format."
        )
        return events

    try:
        events = asyncio.run(execute_agent())
    except Exception as e:
        print(f"Error running ADK agent: {e}")
        return {"error": str(e)}

    print("\nAgent finished execution!")
    
    # Extract response text from the last event or the model's message
    output_text = ""
    if events:
        for event in reversed(events):
            # In ADK, events usually have a `.message` which is a Content object, or a `.content`
            msg = getattr(event, "message", getattr(event, "content", None))
            if msg:
                parts_texts = []
                # In GenAI, the text is inside msg.parts
                if hasattr(msg, "parts") and msg.parts:
                    for p in msg.parts:
                        if hasattr(p, "text") and p.text:
                            parts_texts.append(p.text)
                
                if parts_texts:
                    output_text = "".join(parts_texts)
                    break
        
        # If still empty, just dump the last event
        if not output_text:
            output_text = str(events[-1])
            
    final_state = {"recommendations": []}
        
    try:
        # Pydantic parsing: output_text is guaranteed to be a valid JSON matching the schema
        # because we provided output_schema to ADK!
        # First we try model_validate_json directly. Sometimes ADK surrounds the output with markdown.
        match = re.search(r'```(?:json)?\n(.*?)\n```', output_text, re.DOTALL)
        if match:
            clean_json = match.group(1)
        else:
            clean_json = output_text
            
        validated_model = Recommendations.model_validate_json(clean_json)
        final_state = validated_model.model_dump()
    except Exception as e:
        print("Failed to parse Pydantic JSON response:", e)
        final_state["raw_output"] = output_text
        
        # Fallback to loose dictionary matching just in case
        try:
            if "clean_json" in locals():
                final_state = json.loads(clean_json)
        except Exception:
            pass

    # Make sure we have a directory for data
    os.makedirs('data', exist_ok=True)
    with open('data/data.json', 'w', encoding='utf-8') as file:
        json.dump(final_state, file, indent=4, ensure_ascii=False)
        
    return final_state

if __name__ == "__main__":
    run_agent()