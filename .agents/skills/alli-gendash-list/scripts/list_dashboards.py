import argparse
import os
import sys
import requests
from dotenv import load_dotenv

def get_access_token():
    import base64
    import json
    import time
    from dotenv import load_dotenv, set_key

    def is_jwt_valid(token):
        try:
            parts = token.split('.')
            if len(parts) != 3:
                return False
            payload_b64 = parts[1]
            payload_b64 += '=' * (-len(payload_b64) % 4)
            payload_json = base64.urlsafe_b64decode(payload_b64.encode('utf-8')).decode('utf-8')
            payload = json.loads(payload_json)
            exp = payload.get('exp')
            if exp and exp > time.time() + 30:
                return True
        except Exception:
            pass
        return False

    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '.env')
    load_dotenv(dotenv_path)

    client_id = os.getenv("ALLI_CLIENT_ID")
    refresh_token = os.getenv("ALLI_REFRESH_TOKEN")
    access_token = os.getenv("ALLI_ACCESS_TOKEN")

    if not client_id or not refresh_token:
        print("Error: ALLI_CLIENT_ID or ALLI_REFRESH_TOKEN not found in .env.")
        print("Please run `@[/pmg-cowork-login]alli` first to authenticate.")
        sys.exit(1)

    if access_token and is_jwt_valid(access_token):
        return access_token

    token_url = "https://login.alliplatform.com/token"
    token_data = {
        'grant_type': 'refresh_token',
        'client_id': client_id,
        'refresh_token': refresh_token
    }

    try:
        token_resp = requests.post(token_url, data=token_data)
        token_resp.raise_for_status()
        resp_json = token_resp.json()
        access_token = resp_json.get('access_token')
        new_refresh = resp_json.get('refresh_token')
        
        if access_token:
            set_key(dotenv_path, 'ALLI_ACCESS_TOKEN', access_token)
        if new_refresh and new_refresh != refresh_token:
            set_key(dotenv_path, 'ALLI_REFRESH_TOKEN', new_refresh)
            
        return access_token
    except requests.exceptions.RequestException as e:
        print(f"Failed to refresh access token: {e}")
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="List Generative Dashboards")
    parser.add_argument("--client-id", required=True, help="The client ID")
    parser.add_argument("--user-id", required=False, help="The user ID")
    args = parser.parse_args()

    access_token = get_access_token()
    
    if args.user_id:
        api_url = f"https://generativedashboards.alliplatform.com/api/client/{args.client_id}/users/{args.user_id}/dashboards"
    else:
        api_url = f"https://generativedashboards.alliplatform.com/api/client/{args.client_id}/dashboards"

    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

    try:
        resp = requests.get(api_url, headers=headers)
        resp.raise_for_status()
        resp_data = resp.json()
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch dashboards: {e}")
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text)
        sys.exit(1)

    # API response depends on endpoint (list of items or data wrapped list)
    if isinstance(resp_data, dict) and 'data' in resp_data:
        dashboards = resp_data['data']
    else:
        dashboards = resp_data if isinstance(resp_data, list) else []

    if not dashboards:
        print("No generative dashboards found.")
        sys.exit(0)

    print(f"| Dashboard ID | Title | Visibility | Status |")
    print(f"| :--- | :--- | :--- | :--- |")
    for d in dashboards:
        did = d.get('id', 'N/A')
        title = d.get('title', 'N/A')
        visibility = d.get('visibility', 'N/A')
        status = d.get('status', 'N/A')
        print(f"| {did} | {title} | {visibility} | {status} |")

if __name__ == '__main__':
    main()
