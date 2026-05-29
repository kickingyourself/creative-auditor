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
    parser = argparse.ArgumentParser(description="Fetch all models for a client via UDA v2.1")
    parser.add_argument("--client-id", required=True, help="The client ID to fetch models for")
    parser.add_argument("--default-only", action="store_true", help="Only return the default model")
    args = parser.parse_args()

    access_token = get_access_token()
    
    api_url = f"https://dataexplorer.alliplatform.com/api/v2/clients/{args.client_id}/models"
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

    try:
        resp = requests.get(api_url, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch models: {e}")
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text)
        sys.exit(1)

    models = data.get('models', [])
    if not models:
        print("No models found for this client.")
        sys.exit(0)

    # Sort logic: isAlliDefaultSource (True first), then isCertified (True first)
    models.sort(key=lambda m: (
        not m.get('isAlliDefaultSource', False),
        not m.get('isCertified', False)
    ))

    if args.default_only:
        models = [m for m in models if m.get('isAlliDefaultSource', False)]
        if not models:
            print("No default model found for this client.")
            sys.exit(0)

    print("| Model Name | isAlliDefaultSource | isCertified | Description |")
    print("| :--- | :--- | :--- | :--- |")
    
    for m in models:
        name = m.get('name', 'N/A')
        is_default = "✅" if m.get('isAlliDefaultSource') else "❌"
        is_cert = "✅" if m.get('isCertified') else "❌"
        desc = m.get('description', '') or ''
        # Truncate description for table display if too long
        if len(desc) > 50:
            desc = desc[:47] + "..."
            
        print(f"| {name} | {is_default} | {is_cert} | {desc} |")

if __name__ == '__main__':
    main()
