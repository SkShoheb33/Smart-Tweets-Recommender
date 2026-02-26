import requests
import json
import os
from dotenv import load_dotenv
from helper.getParsedTweets import get_parsed_tweets
load_dotenv()

# ================= EXTERNAL CONFIGURATION OBJECT =================
SESSION_CONFIG = {
    "auth_bearer": os.getenv('AUTH_BEARER_TOKEN'),
    "auth_token": os.getenv('AUTH_TOKEN'),
    "csrf_token": os.getenv('CSRF_TOKEN'),
    "guest_id": os.getenv('GUEST_ID'),
    "twid": os.getenv('TWITTER_ID'),
    "cf_bm_cookie": os.getenv('CF_BM_COOKIE_BOOKMARKS'),
    "client_transaction_id": os.getenv('CLIENT_TRANSACTION_ID_BOOKMARKS'),
    "user_agent": os.getenv('USER_AGENT')
}
# ================================================================  

def get_twitter_bookmarks(config = SESSION_CONFIG):
    # Bookmarks use a specific queryId and a GET request
    query_id = "ynC-aMV_XSM_nEmtj_L3-Q"
    url = f"https://x.com/i/api/graphql/{query_id}/Bookmarks"

    params = {
        "variables": json.dumps({
            "count": 20,
            "includePromotedContent": True
        }),
        "features": json.dumps({
            "rweb_video_screen_enabled": False,
            "profile_label_improvements_pcf_label_in_post_enabled": True,
            "responsive_web_profile_redirect_enabled": False,
            "rweb_tipjar_consumption_enabled": False,
            "verified_phone_label_enabled": True,
            "creator_subscriptions_tweet_preview_api_enabled": True,
            "responsive_web_graphql_timeline_navigation_enabled": True,
            "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
            "premium_content_api_read_enabled": False,
            "communities_web_enable_tweet_community_results_fetch": True,
            "c9s_tweet_anatomy_moderator_badge_enabled": True,
            "responsive_web_grok_analyze_button_fetch_trends_enabled": False,
            "responsive_web_grok_analyze_post_followups_enabled": True,
            "responsive_web_jetfuel_frame": True,
            "responsive_web_grok_share_attachment_enabled": True,
            "responsive_web_grok_annotations_enabled": True,
            "articles_preview_enabled": True,
            "responsive_web_edit_tweet_api_enabled": True,
            "graphql_is_translatable_rweb_tweet_is_translatable_enabled": True,
            "view_counts_everywhere_api_enabled": True,
            "longform_notetweets_consumption_enabled": True,
            "responsive_web_twitter_article_tweet_consumption_enabled": True,
            "tweet_awards_web_tipping_enabled": False,
            "responsive_web_grok_show_grok_translated_post": False,
            "responsive_web_grok_analysis_button_from_backend": True,
            "post_ctas_fetch_enabled": True,
            "freedom_of_speech_not_reach_fetch_enabled": True,
            "standardized_nudges_misinfo": True,
            "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True,
            "longform_notetweets_rich_text_read_enabled": True,
            "longform_notetweets_inline_media_enabled": True,
            "responsive_web_grok_image_annotation_enabled": True,
            "responsive_web_grok_imagine_annotation_enabled": True,
            "responsive_web_grok_community_note_auto_translation_is_enabled": False,
            "responsive_web_enhance_cards_enabled": False
        })
    }

    headers = {
        "accept": "*/*",
        "authorization": f"Bearer {config['auth_bearer']}",
        "content-type": "application/json",
        "referer": "https://x.com/i/bookmarks",
        "user-agent": config['user_agent'],
        "x-csrf-token": config['csrf_token'],
        "x-client-transaction-id": config['client_transaction_id'],
        "x-twitter-active-user": "no",
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-client-language": "en",
    }

    cookies = {
        "auth_token": config['auth_token'],
        "ct0": config['csrf_token'],
        "twid": config['twid'],
        "guest_id": config['guest_id'],
        "__cf_bm": config['cf_bm_cookie'],
    }

    response = requests.get(url, headers=headers, cookies=cookies, params=params)
    if response.status_code == 200:
        return get_parsed_tweets(response.json())
    else:
        return []