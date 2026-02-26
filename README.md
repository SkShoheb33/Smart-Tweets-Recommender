# Smart Bookmark Recommender

This is an AI-powered Chrome Extension and Python Backend built with [LangGraph](https://python.langchain.com/v0.1/docs/langgraph/) and [LangChain](https://python.langchain.com/) that analyzes your X/Twitter bookmarks to build a personalized user profile and recommends new, relevant content based on your interests directly from your timeline.

## How it Works

The tool works by combining a Chrome Extension (to securely capture your session) and a Python Agent:

1. **Session Capture:** The Chrome Extension securely captures your active X.com session tokens (Cookies, Bearer Token, Client Transaction ID) without needing you to input passwords or API keys.
2. **Fetch Bookmarks:** The backend uses these tokens to fetch your recent bookmarks directly from X.
3. **Build Profile:** Uses the **Google Gemini** model to analyze your bookmarked tweets, construct a detailed profile of your interests, and generate specific search queries.
4. **Fetch Candidates:** Loads potential new tweets from your Home Timeline on X.
5. **Score Tweets:** The AI evaluates each candidate tweet against your personal profile, scoring its relevance from 1 to 10 and providing reasoning for the score.
6. **Format Output:** The Chrome extension displays the top personalized tweet recommendations directly in your browser.

## Prerequisites

- Python 3.8+
- Google Chrome Browser
- A Google Gemini API Key (for `langchain-google-genai`)

## Installation & Setup

### 1. Backend Server Setup
1. Clone or download this repository.
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file in the root directory and add your Google API key:
   ```env
   GOOGLE_API_KEY=your_gemini_api_key_here
   ```

### 2. Chrome Extension Setup
1. Open Google Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right corner).
3. Click **Load unpacked** in the top left.
4. Select the `extension` folder located inside this project directory.
5. The "Twitter Agent" extension should now appear in your list. Pin it to your toolbar for easy access.

## Usage

1. **Start the Backend Server:**
   Open your terminal in the project root and run:
   ```bash
   python server.py
   ```
   *Keep this terminal open and running.*

2. **Capture Session:**
   - Open a new tab and go to [x.com](https://x.com) (make sure you are logged in).
   - Let the page fully load so the extension can quietly capture your session tokens in the background.

3. **Get Recommendations:**
   - Click the "Twitter Agent" extension icon in your Chrome toolbar.
   - Click the **"Fetch Recommendations"** button.
   - The extension will send your session to the local backend, the AI will process your bookmarks and timeline, and your personalized tweet recommendations will appear right in the extension window!
