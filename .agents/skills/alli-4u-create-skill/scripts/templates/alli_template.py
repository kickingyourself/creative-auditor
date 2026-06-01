import os
import sys
import argparse
import requests
from dotenv import load_dotenv, set_key

dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..', '.env')
load_dotenv(dotenv_path)


def get_access_token():
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

    client_id = os.getenv("ALLI_CLIENT_ID")
    refresh_token = os.getenv("ALLI_REFRESH_TOKEN")
    access_token = os.getenv("ALLI_ACCESS_TOKEN")

    if not client_id or not refresh_token:
        print("Error: ALLI_CLIENT_ID or ALLI_REFRESH_TOKEN not found in .env.", file=sys.stderr)
        print("Run the pmg-cowork-login skill first to authenticate.", file=sys.stderr)
        sys.exit(1)

    if access_token and is_jwt_valid(access_token):
        return access_token

    token_url = "https://login.alliplatform.com/token"
    token_data = {
        'grant_type': 'refresh_token',
        'client_id': client_id,
        'refresh_token': refresh_token,
    }
    try:
        resp = requests.post(token_url, data=token_data)
        resp.raise_for_status()
        resp_json = resp.json()
        access_token = resp_json.get('access_token')
        new_refresh = resp_json.get('refresh_token')
        if access_token:
            set_key(dotenv_path, 'ALLI_ACCESS_TOKEN', access_token)
        if new_refresh and new_refresh != refresh_token:
            set_key(dotenv_path, 'ALLI_REFRESH_TOKEN', new_refresh)
        return access_token
    except requests.exceptions.RequestException as e:
        print(f"Failed to refresh Alli access token: {e}", file=sys.stderr)
        if hasattr(e, 'response') and e.response is not None:
            print(e.response.text, file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="TODO: describe what this skill does")
    # TODO: add --param arguments here, e.g.:
    # parser.add_argument('--client-slug', required=True, help="The Alli client slug")
    args = parser.parse_args()

    access_token = get_access_token()
    if not access_token:
        print("Error: Could not obtain an Alli access token.", file=sys.stderr)
        sys.exit(1)

    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    }

    # TODO: make your API call here, e.g.:
    # api_url = "https://api.central.alliplatform.com/some-endpoint"
    # response = requests.get(api_url, headers=headers, params={'client': args.client_slug})
    # response.raise_for_status()
    # items = response.json().get('items', [])

    # TODO: update column headers and field names to match the actual API response
    print("| Name | ID | Status |")
    print("|---|---|---|")
    # for item in items:
    #     print(f"| {item.get('name')} | {item.get('id')} | {item.get('status')} |")


if __name__ == '__main__':
    main()
