# Smart Bookmark Recommender

This is an AI-powered agent built with [LangGraph](https://python.langchain.com/v0.1/docs/langgraph/) and [LangChain](https://python.langchain.com/) that analyzes your Twitter/X bookmarks to build a personalized user profile and recommends new, relevant content based on your interests.

## How it Works

The agent runs as a directed graph with the following workflow:

1.  **Fetch Bookmarks:** Reads your saved bookmarks from a local `bookmarks.json` file.
2.  **Build Profile:** Uses the **Gemini 2.5 Flash** model to analyze your bookmarked tweets, construct a detailed profile of your interests, and generate specific search queries.
3.  **Fetch Candidates:** Loads potential new tweets from a local `tweets.json` file and filters them using the generated search queries.
4.  **Score Tweets:** The AI evaluates each candidate tweet against your personal profile, scoring its relevance from 1 to 10 and providing reasoning for the score.
5.  **Format Output:** Displays the top personalized tweet recommendations with their scores and reasoning.

## Prerequisites

- Python 3.8+
- A Google Gemini API Key (for `langchain-google-genai`)

## Installation

1.  Clone or download this repository.
2.  Install the required dependencies:

    ```bash
    pip install -r requirements.txt
    ```

3.  Create a `.env` file in the root directory and add your Google API key:

    ```env
    GOOGLE_API_KEY=your_gemini_api_key_here
    ```
    *(Note: If you are using LangSmith for tracing, you can also add `LANGCHAIN_API_KEY`, `LANGCHAIN_TRACING_V2=true`, and `LANGCHAIN_PROJECT` to your `.env` file.)*

## Data Preparation

To bypass Twitter API restrictions, this agent uses local JSON files for data:

1.  **`bookmarks.json`**: An array of objects representing your bookmarked tweets. Example structure:
    ```json
    [
      { "text": "This is a great tutorial on AI agents..." },
      { "text": "Learning LangGraph is fun!" }
    ]
    ```
2.  **`tweets.json`**: An array of objects representing a pool of candidate tweets to search through. Example structure:
    ```json
    [
      {
        "id": "12345",
        "tweet": "New release of LangChain brings better streaming.",
        "date": "2023-10-01",
        "link": "https://twitter.com/...",
        "nlikes": "100",
        "nretweets": "20"
      }
    ]
    ```

## Usage

Run the agent script:

```bash
python agent.py
```

The script will execute the workflow and print the final recommendations to your console, including the relevance score and the AI's reasoning for why you might like each tweet.
