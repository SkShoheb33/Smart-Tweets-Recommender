import math
from tweets_recommender.helper.getValueBFS import get_value_bfs

def get_parsed_tweet_detail(data):
    data_entries = get_value_bfs(data, 'entries')
    tweet_data = data_entries[0]
    tweet = {
        'entryId': get_value_bfs(tweet_data, 'entryId'),
        'created_at': get_value_bfs(tweet_data, 'created_at'),
        'user': {
            'screen_name': get_value_bfs(tweet_data, 'screen_name'),
            'name': get_value_bfs(tweet_data, 'name'),
            'description': get_value_bfs(tweet_data, 'description'),
            'followers_count': get_value_bfs(tweet_data, 'followers_count'),
            'friends_count': get_value_bfs(tweet_data, 'friends_count')
        },
        'tweet': get_value_bfs(tweet_data, 'full_text'),
        'link': get_value_bfs(tweet_data, 'expanded_url'),
        'favorite_count': get_value_bfs(tweet_data, 'favorite_count'),
        'reply_count': get_value_bfs(tweet_data, 'reply_count'),
        'retweet_count': get_value_bfs(tweet_data, 'retweet_count'),
        'replies': []
    }
    
    replies = []
    for reply in data_entries[1:-1]:
        reply_full_text = get_value_bfs(reply, 'full_text')
        reply_text = get_value_bfs(reply, 'text')
        replies.append({
      'user': {
          'screen_name': get_value_bfs(reply, 'screen_name'),
          'name': get_value_bfs(reply, 'name'),
          'description': get_value_bfs(reply, 'description'),
          'followers_count': get_value_bfs(reply, 'followers_count'),
          'friends_count': get_value_bfs(reply, 'friends_count')

      },
      'reply': reply_text if reply_text and len(reply_text) > len(reply_full_text) else reply_full_text,
      'favorite_count': get_value_bfs(reply, 'favorite_count'),
      'reply_count': get_value_bfs(reply, 'reply_count'),
      'retweet_count': get_value_bfs(reply, 'retweet_count'),
      })
        
    def normalize(value, max_value):
        if not max_value or max_value == 0:
            return 0
        return value / max_value

    def compute_relevance(reply, max_vals):
        # --- Engagement normalization ---
        fav_score = normalize(reply['favorite_count'], max_vals['favorite'])
        reply_score = normalize(reply['reply_count'], max_vals['reply'])
        rt_score = normalize(reply['retweet_count'], max_vals['retweet'])

        engagement_score = (
            0.5 * fav_score +
            0.3 * rt_score +
            0.2 * reply_score
        )

        # --- Author credibility (log scaled) ---
        followers = reply['user']['followers_count'] or 0
        credibility_score = math.log1p(followers)  # log(1 + followers)

        # Normalize credibility
        credibility_score = normalize(
            credibility_score,
            max_vals['max_log_followers']
        )

        # --- Final relevance score ---
        relevance_score = (
            0.7 * engagement_score +
            0.3 * credibility_score
        )

        return relevance_score
    
    max_vals = {
        'favorite': max((r['favorite_count'] or 0) for r in replies),
        'reply': max((r['reply_count'] or 0) for r in replies),
        'retweet': max((r['retweet_count'] or 0) for r in replies),
        'max_log_followers': max(
            math.log1p(r['user']['followers_count'] or 0)
            for r in replies
        )
    }
    for r in replies:
        r['relevance_score'] = compute_relevance(r, max_vals)
    replies.sort(key=lambda x: x['relevance_score'], reverse=True)
    tweet['replies'] = replies
    return tweet
    