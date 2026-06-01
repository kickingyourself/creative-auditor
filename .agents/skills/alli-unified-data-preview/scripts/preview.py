import argparse
import os
import sys
import json
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

def get_default_model(client_id, access_token):
    api_url = f"https://dataexplorer.alliplatform.com/api/v2/clients/{client_id}/models"
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    try:
        resp = requests.get(api_url, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        models = data.get('models', [])
        for m in models:
            if m.get('isAlliDefaultSource'):
                return m.get('name')
        
        if models:
            # Fallback to first certified, or just first model
            for m in models:
                if m.get('isCertified'):
                    return m.get('name')
            return models[0].get('name')
        
        print("Error: No models found for client.")
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch models for default selection: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Fetch a synchronous preview of semantic model data via UDA v2.1")
    parser.add_argument("--client-id", required=True, help="The client ID")
    parser.add_argument("--model", required=False, help="Model name. If omitted, uses default source.")
    parser.add_argument("--start-date", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", required=True, help="End date (YYYY-MM-DD)")
    parser.add_argument("--dimensions", required=False, help="Comma-separated dimensions")
    parser.add_argument("--measures", required=False, help="Comma-separated measures")
    parser.add_argument("--filters", required=False, help="JSON string for filters array")
    parser.add_argument("--granularity", required=False, help="Time granularity (e.g. day, week, month). Omit for no date grouping.")
    args = parser.parse_args()

    access_token = get_access_token()
    
    model_name = args.model
    if not model_name:
        model_name = get_default_model(args.client_id, access_token)
        print(f"[*] Using auto-selected model: {model_name}")

    api_url = f"https://dataexplorer.alliplatform.com/api/v2/clients/{args.client_id}/models/{model_name}/execute-query"
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'Accept': 'text/csv'
    }

    payload = {
        "timeDimensions": [
            {
                "dimension": "date",
                "dateRange": [args.start_date, args.end_date]
            }
        ]
    }
    
    if args.granularity:
        payload["timeDimensions"][0]["granularity"] = args.granularity

    if args.dimensions:
        payload["dimensions"] = [d.strip() for d in args.dimensions.split(',')]
    if args.measures:
        payload["measures"] = [m.strip() for m in args.measures.split(',')]
    if args.filters:
        try:
            payload["filters"] = json.loads(args.filters)
        except json.JSONDecodeError:
            print("Error: --filters must be a valid JSON array string.")
            sys.exit(1)

    try:
        resp = requests.post(api_url, headers=headers, json=payload)
        resp.raise_for_status()
        print(resp.text)
    except requests.exceptions.RequestException as e:
        print(f"Failed to execute query: {e}")
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text)
        sys.exit(1)

if __name__ == '__main__':
    main()
