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
    
    # We load bookmarks from a local JSON file to bypass Twitter API restrictions
    bookmarks_file = "bookmarks.json"
    
    if not os.path.exists(bookmarks_file):
        print(f"File {bookmarks_file} not found. Please create it with your exported Twitter bookmarks.")
        return {"bookmarks": []}
        
    try:
        with open(bookmarks_file, 'r', encoding='utf-8') as f:
            bookmarks_data = json.load(f)
            
        print(f"Loaded {len(bookmarks_data)} bookmarks from {bookmarks_file}")
        return {"bookmarks": bookmarks_data}
    except Exception as e:
        print(f"Error loading bookmarks from {bookmarks_file}: {e}")
        return {"bookmarks": []}

def build_profile_node(state: AgentState) -> Dict[str, Any]:
    print("--- Building Profile ---")
    bookmarks = state.get("bookmarks", [])
    if not bookmarks:
        return {"user_profile": "No bookmarks found.", "search_queries": ["LangChain LangGraph", "AI Agents Gemini", "Twitter API Python"]}

    bookmarks_text = "\n".join([f"- {b['text']}" for b in bookmarks])
    
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
    print("--- Fetching Candidate Tweets (from local JSON) ---")
    queries = state.get("search_queries", [])
    
    candidates = []
    tweets_file = "tweets.json"
    
    if not os.path.exists(tweets_file):
        print(f"File {tweets_file} not found.")
        return {"candidate_tweets": []}
        
    try:
        with open(tweets_file, 'r', encoding='utf-8') as f:
            all_tweets = json.load(f)
            
        print(f"Loaded {len(all_tweets)} potential tweets from {tweets_file}")
        
        # Simple heuristic search: Check if any query word exists in the tweet
        for query in queries:
            query_words = {w for w in query.lower().split() if len(w) > 2}
            
            # Find tweets matching this query
            matched_for_query = []
            for t in all_tweets:
                # Basic string match
                text = t.get("tweet", "").lower()
                # Check for whole word matches
                if any(re.search(rf'\b{re.escape(word)}\b', text) for word in query_words) and len(text) > 20:
                    matched_for_query.append(t)
            
            # Randomly select a few matches for this query to avoid overwhelming the LLM
            if matched_for_query:
                # Let's take up to 10 random matches per query
                sample_size = min(10, len(matched_for_query))
                sampled_tweets = random.sample(matched_for_query, sample_size)
                
                for t in sampled_tweets:
                    if not any(c['id'] == t['id'] for c in candidates):
                        candidates.append({
                            "id": t["id"],
                            "text": t["tweet"],
                            "created_at": t.get("date", ""),
                            "url": t.get("link", ""),
                            "metrics": {"likes": t.get("nlikes", "0"), "retweets": t.get("nretweets", "0")}
                        })
                        
            print(f"  Added {len(sampled_tweets)} candidates for query '{query}'")
                        
    except Exception as e:
        print(f"Error loading candidates from {tweets_file}: {e}")
            
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
         candidates_text += f"ID: {c['id']}\nText: {c['text']}\n\n"
         
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
        candidate_lookup = {c["id"]: c for c in candidates}
        
        for scored in result.scored_tweets:
            # Lowered threshold to 4 to make sure we get *some* recommendations from the random sample
            if scored.score >= 4 and scored.tweet_id in candidate_lookup:
                rec = candidate_lookup[scored.tweet_id]
                rec["score"] = scored.score
                rec["reasoning"] = scored.reasoning
                recommendations.append(rec)
                
        # Sort by score descending
        recommendations = sorted(recommendations, key=lambda x: x["score"], reverse=True)
        
        # Take top N recommendations (e.g., top 5)
        top_n = min(5, len(recommendations))
        return {"recommendations": recommendations[:top_n]}
        
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
        print(f"{i}. Score: {rec.get('score', '?')}/10 | Source: {rec.get('url', rec.get('id', '?'))}")
        print(f"Reasoning: {rec.get('reasoning', '')}")
        print(f"Text: {rec.get('text', '')}")
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

if __name__ == "__main__":
    app = build_graph()
    print("Graph compiled successfully. Tracing should be active if LangSmith is configured.")
    
    print("\nStarting Agent Execution...")
    # Run the compiled graph
    final_state = app.invoke({
        "bookmarks": [], 
        "user_profile": "", 
        "search_queries": [], 
        "candidate_tweets": [], 
        "recommendations": []
    })
    
    print("\nAgent finished execution!")
