from typing import TypedDict, List, Dict, Any

class AgentState(TypedDict):
    bookmarks: List[Dict[str, Any]]
    user_profile: str
    search_queries: List[str]
    candidate_tweets: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]