import os
import sys
import requests
from dotenv import load_dotenv

import base64
import json
import time

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

def get_access_token(dotenv_path):
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

    # Exchange refresh token for access token
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
        
        from dotenv import set_key
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
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '.env')
    access_token = get_access_token(dotenv_path)

    if not access_token:
        print("Error: Authorization server did not return an access token.")
        sys.exit(1)

    # 2. Call the Central API GET /me
    api_url = "https://api.central.alliplatform.com/me"
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }

    try:
        clients_resp = requests.get(api_url, headers=headers)
        clients_resp.raise_for_status()
        clients_data = clients_resp.json()
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch clients from Central API: {e}")
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text)
        sys.exit(1)

    # Extract the clients array from the User object
    user_obj = clients_data.get('user', clients_data)
    clients_list = user_obj.get('clients', [])

    if not clients_list:
        print("No clients found.")
        sys.exit(0)

    # 3. Output as Markdown Table
    print("| Client Name | Client Slug | ID |")
    print("| :--- | :--- | :--- |")
    
    for client in clients_list:
        name = client.get('name', 'N/A')
        slug = client.get('slug', 'N/A')
        c_id = client.get('id', 'N/A')
        print(f"| {name} | {slug} | {c_id} |")

if __name__ == '__main__':
    main()
