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

class UserProfile(BaseModel):
    interests: List[str] = Field(description="Key technical or thematic interests of the user")
    preferred_topics: List[str] = Field(description="Specific topics the user frequently reads about")
    tone: str = Field(description="The general tone or style of content the user prefers")

class LLMScoredTweet(BaseModel):
    entryId: str = Field(description="The ID of the candidate tweet")
    score: int = Field(description="Relevance score from 1 to 10")
    topic: str = Field(description="The preferred topic this tweet best matches, or 'Other' if it doesn't clearly match one")
    highlight: str = Field(description="A 1-2 sentence highlight or summary of the tweet explaining why it's recommended")

class LLMRecommendations(BaseModel):
    recommendations: List[LLMScoredTweet] = Field(description="List of top recommended tweets")

def run_agent(config: Dict[str, Any] = None, status_callback=None):
    if config is None:
        config = {}

    def update_status(status_msg):
        if status_callback:
            status_callback(status_msg)
        else:
            print(f"Status: {status_msg}")

    update_status("Getting bookmarks...")
    try:
        bookmarks = get_twitter_bookmarks(config)
        # Limit to 50 to avoid token overflow
        bookmarks_data = bookmarks[:50]
        print(f"Loaded {len(bookmarks_data)} bookmarks.")
    except Exception as e:
        print(f"Error fetching bookmarks: {e}")
        bookmarks_data = []

    # If no bookmarks, we can't really build a profile or make personalized recommendations
    if not bookmarks_data:
        print("No bookmarks found. Returning empty recommendations.")
        empty_state = {"recommendations": [], "user_profile": None}
        os.makedirs('data', exist_ok=True)
        with open('data/data.json', 'w', encoding='utf-8') as file:
            json.dump(empty_state, file, indent=4, ensure_ascii=False)
        return empty_state

    # -- Agent 1: Profile Builder --
    update_status("Analyzing user profile...")
    profile_builder_agent = Agent(
        model='gemini-2.5-flash',
        name='profile_builder',
        description="Analyzes a list of bookmarks to build a detailed user profile.",
        instruction="""
            You are an expert analyst. Your job is to analyze the provided bookmarked tweets and extract the user's interests, preferred topics, and the general tone of the content they like.
            Return a structured profile representing the user.
        """,
        output_schema=UserProfile
    )

    print("\n--- [Step 2] Building User Profile ---")
    
    async def build_profile():
        runner = InMemoryRunner(agent=profile_builder_agent)
        bookmarks_json = json.dumps(bookmarks_data)
        prompt = f"Analyze these bookmarked tweets and build a profile:\n{bookmarks_json}"
        events = await runner.run_debug(prompt)
        return events

    try:
        if "google_api_key" in config and config["google_api_key"]:
            os.environ["GOOGLE_API_KEY"] = config["google_api_key"]
            
        profile_events = asyncio.run(build_profile())
        
        # Extract response text
        profile_text = ""
        if profile_events:
            for event in reversed(profile_events):
                msg = getattr(event, "message", getattr(event, "content", None))
                if msg:
                    parts_texts = []
                    if hasattr(msg, "parts") and msg.parts:
                        for p in msg.parts:
                            if hasattr(p, "text") and p.text:
                                parts_texts.append(p.text)
                    if parts_texts:
                        profile_text = "".join(parts_texts)
                        break
            if not profile_text:
                profile_text = str(profile_events[-1])
                
        # Parse Profile JSON
        match = re.search(r'```(?:json)?\n(.*?)\n```', profile_text, re.DOTALL)
        clean_profile_json = match.group(1) if match else profile_text
        profile = UserProfile.model_validate_json(clean_profile_json)
        print(f"Generated Profile: Interests: {profile.interests}")
        
    except Exception as e:
        print(f"Error building profile: {e}")
        # Fallback profile
        profile = UserProfile(interests=["General Technology"], preferred_topics=["Tech News"], tone="Informative")

    update_status("Getting tweets...")
    print("\n--- [Step 3] Fetching Candidate Tweets ---")
    try:
        timeline_tweets = make_home_timeline_request(config)
        # Limit to 50
        timeline_data = timeline_tweets[:50]
        print(f"Loaded {len(timeline_data)} timeline tweets.")
    except Exception as e:
        print(f"Error fetching timeline: {e}")
        timeline_data = []

    if not timeline_data:
        print("No timeline tweets found. Returning empty recommendations.")
        empty_state = {"recommendations": [], "user_profile": profile.model_dump() if 'profile' in locals() else None}
        os.makedirs('data', exist_ok=True)
        with open('data/data.json', 'w', encoding='utf-8') as file:
            json.dump(empty_state, file, indent=4, ensure_ascii=False)
        return empty_state

    # -- Agent 2: Tweet Scorer --
    update_status("Recommending tweets...")
    scorer_agent = Agent(
        model='gemini-2.5-flash',
        name='tweet_scorer',
        description="Scores candidate tweets against a user profile.",
        instruction="""
            You are a helpful agent that curates a personalized Twitter feed.
            You will be given a User Profile and a list of Candidate Tweets containing only 'entryId' and 'tweet' text.
            
            Evaluate each candidate tweet against the user profile. Score each tweet's relevance to the user from 1 to 10. 
            Be lenient, if a tweet even tangentially relates to the user's interests, give it a score of 5 or higher.
            Select the top 10 recommended tweets, and return their entryIds, scores, matching topic, and a 1-2 sentence highlight summarizing why it is recommended based on their profile.
        """,
        output_schema=LLMRecommendations
    )

    print("\n--- [Step 4] Scoring Tweets ---")
    
    async def score_tweets():
        runner = InMemoryRunner(agent=scorer_agent)
        
        # Strip down the timeline data to save tokens
        stripped_timeline = [
            {"entryId": t.get("entryId"), "tweet": t.get("tweet")} 
            for t in timeline_data if t.get("tweet")
        ]
        
        prompt = f"""
            User Profile:
            {profile.model_dump_json(indent=2)}
            
            Candidate Tweets:
            {json.dumps(stripped_timeline)}
            
            Please score the tweets and return the top recommendations.
        """
        events = await runner.run_debug(prompt)
        return events

    try:
        scoring_events = asyncio.run(score_tweets())
        
        # Extract response text
        output_text = ""
        if scoring_events:
            for event in reversed(scoring_events):
                msg = getattr(event, "message", getattr(event, "content", None))
                if msg:
                    parts_texts = []
                    if hasattr(msg, "parts") and msg.parts:
                        for p in msg.parts:
                            if hasattr(p, "text") and p.text:
                                parts_texts.append(p.text)
                    if parts_texts:
                        output_text = "".join(parts_texts)
                        break
            if not output_text:
                output_text = str(scoring_events[-1])
                
        # Parse Recommendations JSON
        match = re.search(r'```(?:json)?\n(.*?)\n```', output_text, re.DOTALL)
        clean_json = match.group(1) if match else output_text
            
        validated_model = LLMRecommendations.model_validate_json(clean_json)
        llm_scores = validated_model.model_dump()["recommendations"]
        
        # Re-map the scores back to the full original tweet objects
        final_recommendations = []
        timeline_dict = {t["entryId"]: t for t in timeline_data}
        
        for scored_item in llm_scores:
            tweet_id = scored_item["entryId"]
            if tweet_id in timeline_dict:
                full_tweet = timeline_dict[tweet_id]
                full_tweet["score"] = scored_item["score"]
                full_tweet["topic"] = scored_item.get("topic", "Other")
                full_tweet["highlight"] = scored_item.get("highlight", "")
                final_recommendations.append(full_tweet)
                
        # Sort by score descending
        final_recommendations = sorted(final_recommendations, key=lambda x: x.get("score", 0), reverse=True)
                
        final_state = {"recommendations": final_recommendations, "user_profile": profile.model_dump() if 'profile' in locals() else None}
        print(f"Successfully generated {len(final_recommendations)} recommendations.")
        
    except Exception as e:
        print(f"Error during scoring phase: {e}")
        final_state = {"recommendations": [], "user_profile": profile.model_dump() if 'profile' in locals() else None}

    print("\nAgent finished execution!")

    # Make sure we have a directory for data
    os.makedirs('data', exist_ok=True)
    with open('data/data.json', 'w', encoding='utf-8') as file:
        json.dump(final_state, file, indent=4, ensure_ascii=False)
        
    return final_state

if __name__ == "__main__":
    run_agent()