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

from tweets_recommender.api.getTweetDetails import get_tweet_detail

load_dotenv()

class KeyStatistics(BaseModel):
    questions: List[str] = Field(description="Important questions raised in the post or replies")
    facts: List[str] = Field(description="Key facts stated in the post or replies")

class Keypoints(BaseModel):
    main_claim: str = Field(description="The main claim of the post")
    supporting_arguments: List[str] = Field(description="Supporting arguments found in the post or replies")
    counter_arguments: List[str] = Field(description="Counter arguments found in the post or replies")
    key_statistics: KeyStatistics

class SentimentOverview(BaseModel):
    positive_percentage: int = Field(description="Positive sentiment percentage (0-100)")
    negative_percentage: int = Field(description="Negative sentiment percentage (0-100)")
    neutral_percentage: int = Field(description="Neutral sentiment percentage (0-100)")

class PostAnalysis(BaseModel):
    summary: str = Field(description="1-2 sentences about what the post is saying")
    keypoints: Keypoints
    sentiment: SentimentOverview = Field(description="Sentiment distribution percentages that add up to 100")
    controversy_level: str = Field(description="Controversy level: low, medium, or high")
    trust_percentage: int = Field(description="Trust score from 0 to 100 based on facts and credibility")

def generate_markdown(analysis: PostAnalysis) -> str:
    md = f"### Summary\n{analysis.summary}\n\n"
    
    md += "### Key Points\n"
    md += f"- **Main Claim:** {analysis.keypoints.main_claim}\n"
    
    if analysis.keypoints.supporting_arguments:
        md += "- **Supporting Arguments:**\n"
        for arg in analysis.keypoints.supporting_arguments:
            md += f"  - {arg}\n"
            
    if analysis.keypoints.counter_arguments:
        md += "- **Counter Arguments:**\n"
        for arg in analysis.keypoints.counter_arguments:
            md += f"  - {arg}\n"
            
    md += "- **Key Statistics & Methods:**\n"
    if analysis.keypoints.key_statistics.questions:
        md += "  - **Questions:**\n"
        for q in analysis.keypoints.key_statistics.questions:
            md += f"    - {q}\n"
    if analysis.keypoints.key_statistics.facts:
        md += "  - **Facts:**\n"
        for f in analysis.keypoints.key_statistics.facts:
            md += f"    - {f}\n"
    
    md += "\n### Sentiment Overview\n"
    md += "```mermaid\n"
    md += "pie title Sentiment Distribution\n"
    md += f'  "Positive" : {analysis.sentiment.positive_percentage}\n'
    md += f'  "Negative" : {analysis.sentiment.negative_percentage}\n'
    md += f'  "Neutral" : {analysis.sentiment.neutral_percentage}\n'
    md += "```\n\n"
    
    md += f"### Controversy Level\n**{analysis.controversy_level.capitalize()}**\n\n"
    
    md += f"### Trust Score\n**{analysis.trust_percentage}%**\n"
    
    return md

def run_post_analysis_agent(tweet_id: str, config: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Fetches the tweet details and its replies, analyzes it, and returns a structured dictionary.
    """
    if config is None:
        config = {}
        
    print(f"Fetching details for tweet ID: {tweet_id}")
    tweet_data = get_tweet_detail(tweet_id, config)
    
    if not tweet_data:
        return {"error": "Could not fetch details for this tweet."}
        
    # Prepare data for the agent
    # We will pass the main tweet and top replies (sorted by relevance) to avoid token limits
    main_tweet_text = tweet_data.get('tweet', '')
    replies = tweet_data.get('replies', [])
    top_replies = replies[:20] # limit to top 20 relevant replies
    
    prompt_data = {
        "main_tweet": main_tweet_text,
        "author": tweet_data.get('user', {}).get('name', ''),
        "replies": [r.get('reply', '') for r in top_replies]
    }
    
    analysis_agent = Agent(
        model='gemini-2.5-flash',
        name='post_analyzer',
        description="Analyzes a tweet and its replies to extract keypoints, sentiment, controversy, and trust.",
        instruction="""
            You are an expert content analyzer. You will be provided with a main tweet and its top replies.
            Analyze the content to extract the following:
            1. A 1-2 sentence summary of what the post is about.
            2. Key points including the main claim, supporting arguments, counter arguments (often found in replies), and key facts/questions.
            3. The overall sentiment distribution across the post and replies (positive, negative, neutral percentages that sum to 100).
            4. The controversy level (low, medium, or high) based on the conflict in replies.
            5. A trust score percentage (0-100) based on how factual, logical, and well-supported the post and replies are.
        """,
        output_schema=PostAnalysis
    )

    print("\n--- Analyzing Post ---")
    
    async def analyze():
        runner = InMemoryRunner(agent=analysis_agent)
        prompt = f"Analyze the following tweet and its replies:\n{json.dumps(prompt_data, indent=2)}"
        events = await runner.run_debug(prompt)
        return events

    try:
        if "google_api_key" in config and config["google_api_key"]:
            os.environ["GOOGLE_API_KEY"] = config["google_api_key"]
            
        analysis_events = asyncio.run(analyze())
        
        # Extract response text
        output_text = ""
        if analysis_events:
            for event in reversed(analysis_events):
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
                output_text = str(analysis_events[-1])
                
        # Parse JSON output
        match = re.search(r'```(?:json)?\n(.*?)\n```', output_text, re.DOTALL)
        clean_json = match.group(1) if match else output_text
        
        analysis = PostAnalysis.model_validate_json(clean_json)
        print("Analysis completed successfully.")
        return analysis.model_dump()
        
    except Exception as e:
        print(f"Error during post analysis: {e}")
        return {"error": f"An error occurred while analyzing the post: {str(e)}"}

if __name__ == "__main__":
    # Test with a dummy tweet ID if run directly
    import sys
    test_id = sys.argv[1] if len(sys.argv) > 1 else "1894283832367178049"  # Use a valid ID from the timeline for testing
    print(run_post_analysis_agent(test_id))
