import argparse
import os
import sys
import json
import time
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
            # Fallback
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
    parser = argparse.ArgumentParser(description="Export semantic model data via UDA v2.1")
    parser.add_argument("--client-id", required=True, help="The client ID")
    parser.add_argument("--model", required=False, help="Model name. If omitted, uses default source.")
    parser.add_argument("--start-date", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", required=True, help="End date (YYYY-MM-DD)")
    parser.add_argument("--dimensions", required=False, help="Comma-separated dimensions")
    parser.add_argument("--measures", required=False, help="Comma-separated measures")
    parser.add_argument("--filters", required=False, help="JSON string for filters array")
    parser.add_argument("--granularity", required=False, help="Time granularity (e.g. day, week, month). Omit for no date grouping.")
    parser.add_argument("--output-file", required=False, help="Path to save the downloaded CSV")
    args = parser.parse_args()

    access_token = get_access_token()
    
    model_name = args.model
    if not model_name:
        model_name = get_default_model(args.client_id, access_token)
        print(f"[*] Using auto-selected model: {model_name}")

    # 1. Trigger the export
    export_url = f"https://dataexplorer.alliplatform.com/api/v2/clients/{args.client_id}/models/{model_name}/export-data"
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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

    print("[*] Initiating data export...")
    try:
        resp = requests.post(export_url, headers=headers, json=payload)
        resp.raise_for_status()
        export_data = resp.json()
        export_id = export_data.get('dataExportId')
        if not export_id:
            print("Error: dataExportId not returned in the response.")
            sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f"Failed to initiate export: {e}")
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text)
        sys.exit(1)

    # 2. Poll for completion
    poll_url = f"https://dataexplorer.alliplatform.com/api/v2/data-exports/{export_id}"
    print(f"[*] Polling export status for {export_id}...")
    
    download_url = None
    while True:
        try:
            poll_resp = requests.get(poll_url, headers=headers)
            poll_resp.raise_for_status()
            status_data = poll_resp.json()
            status = status_data.get('status')
            
            if status == 'completed':
                links = status_data.get('_links', {})
                data_link = links.get('data', {}).get('href')
                result_link = links.get('result', {}).get('href')
                if data_link:
                    download_url = f"https://dataexplorer.alliplatform.com/api/v2{data_link}"
                    break
                elif result_link:
                    download_url = result_link
                    break
                else:
                    print("Error: Export completed but no result link found.")
                    sys.exit(1)
            elif status == 'completed_no_result':
                print("[*] Export completed but returned no data.")
                sys.exit(0)
            elif status == 'failed':
                print(f"Error: Export failed: {status_data.get('message')}")
                sys.exit(1)
            else:
                time.sleep(3)
        except requests.exceptions.RequestException as e:
            print(f"Failed during polling: {e}")
            if hasattr(e, 'response') and e.response is not None:
                 print(e.response.text)
            sys.exit(1)

    # 3. Download the data
    print(f"[*] Export completed. Downloading data from {download_url}...")
    try:
        # The download URL requires authentication.
        dl_resp = requests.get(download_url, headers=headers, stream=True)
        dl_resp.raise_for_status()
        
        # Check size if not writing to file
        content = dl_resp.content
        size_mb = len(content) / (1024 * 1024)
        
        if args.output_file:
            with open(args.output_file, 'wb') as f:
                f.write(content)
            print(f"[*] Data saved to {args.output_file} ({size_mb:.2f} MB)")
        else:
            if size_mb < 5.0:
                print("\n" + content.decode('utf-8'))
            else:
                default_file = f"export_{export_id}.csv"
                with open(default_file, 'wb') as f:
                    f.write(content)
                print(f"[*] Result too large for console output ({size_mb:.2f} MB). Saved to {default_file}")

    except requests.exceptions.RequestException as e:
        print(f"Failed to download data: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
