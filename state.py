from typing import TypedDict, List, Dict, Any

class AgentState(TypedDict):
    config: Dict[str, Any]
    bookmarks: List[Dict[str, Any]]
    user_profile: str
    search_queries: List[str]
    candidate_tweets: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]