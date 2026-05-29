import os
import argparse
import requests
from dotenv import load_dotenv, set_key

dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '.env')
load_dotenv(dotenv_path)

def refresh_slack_token(client_id, refresh_token):
    # Attempt to refresh token
    url = "https://slack.com/api/oauth.v2.access"
    data = {
        'client_id': client_id,
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token
    }
    
    # If there's a client secret, send it
    client_secret = os.getenv('SLACK_CLIENT_SECRET')
    if client_secret:
        data['client_secret'] = client_secret
        
    try:
        response = requests.post(url, data=data)
        response.raise_for_status()
        token_data = response.json()
        
        if token_data.get('ok'):
            # Save new tokens
            new_access_token = token_data.get('access_token')
            new_refresh_token = token_data.get('refresh_token')
            
            if new_refresh_token:
                set_key(dotenv_path, 'SLACK_REFRESH_TOKEN', new_refresh_token)
                print("Successfully rotated SLACK_REFRESH_TOKEN in .env")
                
            return new_access_token
        else:
            # Maybe the token in our .env was actually an access_token fallback
            error_msg = token_data.get('error', '')
            if 'invalid_refresh_token' in error_msg or 'invalid_grant' in error_msg:
                # Let's hope it's a non-rotating access token!
                print(f"Token refresh failed ({error_msg}). Assuming SLACK_REFRESH_TOKEN is a durable token.")
                return refresh_token
            else:
                print(f"Error from Slack API during token refresh: {error_msg}")
                return None
            
    except Exception as e:
        print(f"Exception during token refresh: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Send a message to a Slack channel")
    parser.add_argument('--channel', required=True, help="Slack channel ID or name")
    parser.add_argument('--message', required=True, help="Message text to send")
    
    args = parser.parse_args()
    
    refresh_token_env = os.getenv('SLACK_REFRESH_TOKEN')
    client_id = os.getenv('SLACK_CLIENT_ID')
    
    if not refresh_token_env or not client_id:
        print("Error: Missing SLACK_REFRESH_TOKEN or SLACK_CLIENT_ID in .env")
        exit(1)
        
    # Slack refresh tokens typically start with xoxe-1- and rotating access tokens are xoxe.xoxp-1-
    # If the token is obviously an access token (xoxp-..., xoxb-..., xoxe.xoxp-...), skip refresh.
    if refresh_token_env.startswith("xoxp-") or refresh_token_env.startswith("xoxe.xoxp-") or refresh_token_env.startswith("xoxb-"):
        print("Token appears to be a static access token. Skipping refresh.")
        access_token = refresh_token_env
    else:
        access_token = refresh_slack_token(client_id, refresh_token_env)
        
    if not access_token:
        print("Error: Could not obtain a valid access token.")
        exit(1)
        
    # Send message
    post_url = "https://slack.com/api/chat.postMessage"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "channel": args.channel,
        "text": args.message,
        "as_user": True
    }
    
    try:
        response = requests.post(post_url, headers=headers, json=payload)
        response.raise_for_status()
        res_data = response.json()
        
        if res_data.get('ok'):
            print(f"Successfully sent message to {args.channel}!")
        else:
            print(f"Failed to send message: {res_data.get('error')}")
            print(res_data)
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text)

if __name__ == '__main__':
    main()
