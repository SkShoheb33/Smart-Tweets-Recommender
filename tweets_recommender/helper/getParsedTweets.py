from tweets_recommender.helper.getValueBFS import get_value_bfs

def get_parsed_tweets(data):
    parsed_tweets = []
    tweets = get_value_bfs(data, 'entries')
    
    if not tweets:
        return parsed_tweets
        
    for index in range(len(tweets)):
        tweet = tweets[index]
        tweet_text = get_value_bfs(tweet, 'full_text')
        
        if not tweet_text:
            continue
            
        parsed_tweet = {
            'entryId': get_value_bfs(tweet, 'entryId') or f"tweet-{index}",
            'sortIndex': get_value_bfs(tweet, 'sortIndex'),
            'created_at': get_value_bfs(tweet, 'created_at'),
            'created_by': get_value_bfs(tweet, 'screen_name'),
            'tweet': tweet_text,
            'hashtags': get_value_bfs(tweet, 'hashtags'),
            'link': get_value_bfs(tweet, 'expanded_url'),
            'nlikes': get_value_bfs(tweet, 'favorite_count') or 0,
            'nreplies': get_value_bfs(tweet, 'reply_count') or 0,
            'nretweets': get_value_bfs(tweet, 'retweet_count') or 0,
            'nviews': get_value_bfs(tweet, 'ext_views') or get_value_bfs(tweet, 'views') or 0
        }
        
        # Extract view count from dict if needed
        if isinstance(parsed_tweet['nviews'], dict):
            parsed_tweet['nviews'] = parsed_tweet['nviews'].get('count', 0)
            
        parsed_tweets.append(parsed_tweet)
    return parsed_tweets