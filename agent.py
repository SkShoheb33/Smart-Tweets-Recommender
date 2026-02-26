import os
import sys
import json
import random
import re
from typing import Any, Dict, List
from pydantic import BaseModel, Field
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langgraph.graph import StateGraph, START, END

from state import AgentState
from helper.getParsedTweets import get_parsed_tweets
from api.getBookMarks import get_twitter_bookmarks
from api.getTweets import make_home_timeline_request

load_dotenv()

# --- Pydantic Models for Structured Output ---

class ProfileOutput(BaseModel):
    user_profile: str = Field(description="Detailed profile of the user's interests, preferred topics, and tone.")
    search_queries: List[str] = Field(description="List of exactly 3 search queries to find similar new content on Twitter.")

class ScoredTweet(BaseModel):
    tweet_id: str = Field(description="The ID of the candidate tweet")
    score: int = Field(description="Relevance score from 1 to 10")
    reasoning: str = Field(description="A 1-sentence reasoning for the score")

class ScoringOutput(BaseModel):
    scored_tweets: List[ScoredTweet] = Field(description="List of scored tweets")

# --- LLM Initialization ---

# Initialize Gemini 2.5 Flash
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.2
)

# --- Nodes ---

def fetch_bookmarks_node(state: AgentState) -> Dict[str, Any]:
    print("--- Fetching Bookmarks (from JSON export) ---")
    config = state.get("config", {})
    
    # We load bookmarks from a local JSON file to bypass Twitter API restrictions
    try:
        bookmarks_data = get_twitter_bookmarks(config)
            
        print(f"Loaded {len(bookmarks_data)} bookmarks from Twitter")
        return {"bookmarks": bookmarks_data}
    except Exception as e:
        print(f"Error loading bookmarks from Twitter: {e}")
        return {"bookmarks": []}

def build_profile_node(state: AgentState) -> Dict[str, Any]:
    print("--- Building Profile ---")
    bookmarks = state.get("bookmarks", [])
    if not bookmarks:
        return {"user_profile": "No bookmarks found.", "search_queries": ["LangChain LangGraph", "AI Agents Gemini", "Twitter API Python"]}

    bookmarks_text = "\n".join([f"- {b['tweet']}" for b in bookmarks])
    
    prompt = PromptTemplate.from_template(
        "Analyze these bookmarked tweets:\n\n{bookmarks}\n\n"
        "Create a detailed profile of the user's interests, preferred topics, and tone. "
        "Also generate exactly 3 distinct search queries to find similar new content on Twitter."
    )
    
    structured_llm = llm.with_structured_output(ProfileOutput)
    chain = prompt | structured_llm
    
    result = chain.invoke({"bookmarks": bookmarks_text})
    
    return {
        "user_profile": result.user_profile,
        "search_queries": result.search_queries
    }

def fetch_candidates_node(state: AgentState) -> Dict[str, Any]:
    print("--- Fetching Candidate Tweets (from Twitter) ---")
    queries = state.get("search_queries", [])
    config = state.get("config", {})
    
    candidates = []
        
    try:
        all_tweets = make_home_timeline_request(config)
        
        if not all_tweets:
            all_tweets = []
            
        print(f"Loaded {len(all_tweets)} potential tweets from Twitter")
        
        # Simple heuristic search: Check if any query word exists in the tweet
        for query in queries:
            query_words = {w for w in query.lower().split() if len(w) > 2}
            
            # Find tweets matching this query
            matched_for_query = []
            for t in all_tweets:
                # Basic string match
                text = t.get("tweet")
                if text is None:
                    text = ""
                text = text.lower()
                # Check for whole word matches
                if any(re.search(rf'\b{re.escape(word)}\b', text) for word in query_words) and len(text) > 20:
                    matched_for_query.append(t)
            
            # Randomly select a few matches for this query to avoid overwhelming the LLM
            sampled_tweets = []
            if matched_for_query:
                # Let's take up to 10 random matches per query
                sample_size = min(10, len(matched_for_query))
                sampled_tweets = random.sample(matched_for_query, sample_size)
                
                for t in sampled_tweets:
                    if not any(c.get('entryId') == t.get('entryId') for c in candidates):
                        candidates.append({
                            "entryId": t.get("entryId", ""),
                            "tweet": t.get("tweet", ""),
                            "created_at": t.get("created_at", ""),
                            "created_by": t.get("created_by", ""),
                            "link": t.get("link", ""),
                            "metrics": {"likes": t.get("nlikes", "0"), "retweets": t.get("nretweets", "0"), "replies": t.get("nreplies", "0")}
                        })
                        
            print(f"  Added {len(sampled_tweets)} candidates for query '{query}'")

        # Ensure we have a minimum of 10 tweets
        if len(candidates) < 10 and all_tweets:
            print(f"  Padding candidates to reach minimum of 10. Found {len(all_tweets)} total tweets.")
            remaining_tweets = [t for t in all_tweets if not any(c.get('entryId') == t.get('entryId') for c in candidates)]
            valid_remaining = [t for t in remaining_tweets if t.get("tweet") and len(t.get("tweet")) > 20]
            
            needed = 10 - len(candidates)
            padding_tweets = random.sample(valid_remaining, min(needed, len(valid_remaining)))
            
            for t in padding_tweets:
                candidates.append({
                    "entryId": t.get("entryId", ""),
                    "tweet": t.get("tweet", ""),
                    "created_at": t.get("created_at", ""),
                    "created_by": t.get("created_by", ""),
                    "link": t.get("link", ""),
                    "metrics": {"likes": t.get("nlikes", "0"), "retweets": t.get("nretweets", "0"), "replies": t.get("nreplies", "0")}
                })
            print(f"  Added {len(padding_tweets)} padding candidates")
                        
    except Exception as e:
        print(f"Error loading candidates from Twitter: {e}")
            
    return {"candidate_tweets": candidates}

def score_tweets_node(state: AgentState) -> Dict[str, Any]:
    print("--- Scoring Candidate Tweets ---")
    profile = state.get("user_profile", "")
    candidates = state.get("candidate_tweets", [])
    
    if not candidates:
        return {"recommendations": []}
        
    # Prepare prompt
    candidates_text = ""
    for c in candidates:
         candidates_text += f"ID: {c['entryId']}\nText: {c['tweet']}\n\n"
         
    prompt = PromptTemplate.from_template(
        "User Profile:\n{profile}\n\n"
        "Candidate Tweets:\n{candidates}\n\n"
        "Evaluate each candidate tweet against the user profile. "
        "Score each tweet's relevance to the user from 1 to 10, and provide a 1-sentence reasoning. "
        "Please be lenient; if a tweet even tangentially relates to the user's technical interests, give it a score of 5 or higher."
    )
    
    structured_llm = llm.with_structured_output(ScoringOutput)
    chain = prompt | structured_llm
    
    try:
        result = chain.invoke({"profile": profile, "candidates": candidates_text})
        
        # Filter and build final recommendations
        recommendations = []
        # Create a lookup for original candidate details
        candidate_lookup = {c["entryId"]: c for c in candidates}
        
        for scored in result.scored_tweets:
            # Remove strict threshold to ensure we get enough recommendations
            if scored.tweet_id in candidate_lookup:
                rec = candidate_lookup[scored.tweet_id]
                rec["score"] = scored.score
                rec["reasoning"] = scored.reasoning
                recommendations.append(rec)
                
        # Sort by score descending
        recommendations = sorted(recommendations, key=lambda x: x["score"], reverse=True)
        
        # Ensure we return at least 10 recommendations if available
        top_n = max(10, min(10, len(recommendations))) 
        return {"recommendations": recommendations[:max(10, 10)]}
        
    except Exception as e:
        print(f"Error during scoring: {e}")
        return {"recommendations": []}

def format_output_node(state: AgentState) -> Dict[str, Any]:
    print("\n=======================================================")
    print("FINAL RECOMMENDATIONS")
    print("=======================================================\n")
    
    recommendations = state.get("recommendations", [])
    if not recommendations:
        print("No suitable tweets found for recommendation.")
        return state
        
    for i, rec in enumerate(recommendations, 1):
        print(f"{i}. Score: {rec.get('score', '?')}/10 | Source: {rec.get('link', rec.get('entryId', '?'))}")
        print(f"Reasoning: {rec.get('reasoning', '')}")
        print(f"Text: {rec.get('tweet', '')}")
        print("-" * 50)
        
    return state

# --- Compile Graph ---

def build_graph():
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("fetch_bookmarks", fetch_bookmarks_node)
    workflow.add_node("build_profile", build_profile_node)
    workflow.add_node("fetch_candidates", fetch_candidates_node)
    workflow.add_node("score_tweets", score_tweets_node)
    workflow.add_node("format_output", format_output_node)
    
    # Add edges
    workflow.add_edge(START, "fetch_bookmarks")
    workflow.add_edge("fetch_bookmarks", "build_profile")
    workflow.add_edge("build_profile", "fetch_candidates")
    workflow.add_edge("fetch_candidates", "score_tweets")
    workflow.add_edge("score_tweets", "format_output")
    workflow.add_edge("format_output", END)
    
    # Compile
    app = workflow.compile()
    return app

def run_agent(config: Dict[str, Any] = None):
    app = build_graph()
    if config is None:
        config = {}
    
    print("\nStarting Agent Execution...")
    final_state = app.invoke({
        "config": config,
        "bookmarks": [], 
        "user_profile": "", 
        "search_queries": [], 
        "candidate_tweets": [], 
        "recommendations": []
    })
    print("\nAgent finished execution!")
    
    # Save the output to JSON so it can be served or inspected
    with open('data/data.json', 'w') as file:
        # Avoid saving the config dict to the public JSON for security
        state_to_save = {k: v for k, v in final_state.items() if k != 'config'}
        json.dump(state_to_save, file, indent=4)
        
    return final_state

if __name__ == "__main__":
    run_agent()
