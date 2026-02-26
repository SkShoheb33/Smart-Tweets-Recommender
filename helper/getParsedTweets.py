from helper.getValueBFS import get_value_bfs

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
            'nlikes': get_value_bfs(tweet, 'favorite_count'),
            'nreplies': get_value_bfs(tweet, 'reply_count'),
            'nretweets': get_value_bfs(tweet, 'retweet_count')
        }
        parsed_tweets.append(parsed_tweet)
    return parsed_tweets