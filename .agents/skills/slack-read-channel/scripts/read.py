import os
import argparse
import requests
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv, set_key

dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '.env')
load_dotenv(dotenv_path)

def refresh_slack_token(client_id, refresh_token):
    url = "https://slack.com/api/oauth.v2.access"
    data = {
        'client_id': client_id,
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token
    }
    
    client_secret = os.getenv('SLACK_CLIENT_SECRET')
    if client_secret:
        data['client_secret'] = client_secret
        
    try:
        response = requests.post(url, data=data)
        response.raise_for_status()
        token_data = response.json()
        
        if token_data.get('ok'):
            new_access_token = token_data.get('access_token')
            new_refresh_token = token_data.get('refresh_token')
            if new_refresh_token:
                set_key(dotenv_path, 'SLACK_REFRESH_TOKEN', new_refresh_token)
            return new_access_token
        else:
            error_msg = token_data.get('error', '')
            if 'invalid_refresh_token' in error_msg or 'invalid_grant' in error_msg:
                # Fallback to static access token
                return refresh_token
            return None
    except Exception as e:
        return None

def get_channel_id(access_token, channel_name):
    url = "https://slack.com/api/conversations.list"
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"exclude_archived": True, "limit": 1000, "types": "public_channel,private_channel"}
    
    clean_name = channel_name.lstrip('#')
    
    # Slack allows pagination, we'll try to find it in the first 1000
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        res_data = response.json()
        if res_data.get('ok'):
            for c in res_data.get('channels', []):
                if c.get('name') == clean_name:
                    return c.get('id')
    except Exception:
        pass
    return channel_name # Fallback to original, might just be an ID anyway!

def main():
    parser = argparse.ArgumentParser(description="Read messages from a Slack channel")
    parser.add_argument('--channel', required=True, help="Slack channel ID or name")
    parser.add_argument('--days_back', type=int, default=2, help="Number of days back")
    
    args = parser.parse_args()
    
    refresh_token_env = os.getenv('SLACK_REFRESH_TOKEN')
    client_id = os.getenv('SLACK_CLIENT_ID')
    
    if not refresh_token_env or not client_id:
        print(json.dumps({"error": "Missing SLACK_REFRESH_TOKEN or SLACK_CLIENT_ID in .env"}))
        exit(1)
        
    if refresh_token_env.startswith("xoxp-") or refresh_token_env.startswith("xoxe.xoxp-") or refresh_token_env.startswith("xoxb-"):
        access_token = refresh_token_env
    else:
        access_token = refresh_slack_token(client_id, refresh_token_env)
        
    if not access_token:
        print(json.dumps({"error": "Could not obtain a valid access token."}))
        exit(1)
        
    # Resolve channel ID if it's a name
    channel_id = args.channel
    if channel_id.startswith('#') or not channel_id.startswith('C'):
        # Just in case it's a name passed without #
        mapped_id = get_channel_id(access_token, channel_id)
        if mapped_id:
            channel_id = mapped_id
            
    # Calculate threshold
    oldest_ts = (datetime.now() - timedelta(days=args.days_back)).timestamp()
    
    history_url = "https://slack.com/api/conversations.history"
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {
        "channel": channel_id,
        "oldest": oldest_ts,
        "limit": 900
    }
    
    try:
        response = requests.get(history_url, headers=headers, params=params)
        response.raise_for_status()
        res_data = response.json()
        
        if res_data.get('ok'):
            messages = res_data.get('messages', [])
            print(json.dumps({
                "channel": channel_id,
                "days_back": args.days_back,
                "messages_count": len(messages),
                "messages": messages
            }, indent=2))
        else:
            print(json.dumps({"error": f"Failed to get history: {res_data.get('error')}", "details": res_data}, indent=2))
            
    except requests.exceptions.RequestException as e:
        print(json.dumps({"error": "Request exception", "details": str(e)}))

if __name__ == '__main__':
    main()
