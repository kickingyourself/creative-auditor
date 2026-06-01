#!/usr/bin/env python3
import os
import sys
import argparse

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
except ImportError:
    print("Error: Missing required Python packages.", file=sys.stderr)
    print("Run: pip3 install google-api-python-client google-auth", file=sys.stderr)
    sys.exit(1)

def load_env():
    """Simple parser to load .env into os.environ."""
    cwd = os.getcwd()
    env_path = os.path.join(cwd, '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    parts = line.split('=', 1)
                    if len(parts) == 2:
                        key = parts[0].strip()
                        val = parts[1].strip()
                        if val.startswith('"') and val.endswith('"'): val = val[1:-1]
                        elif val.startswith("'") and val.endswith("'"): val = val[1:-1]
                        os.environ[key] = val

def get_service():
    load_env()
    creds_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')

    if not creds_path:
        print("Error: GOOGLE_APPLICATION_CREDENTIALS is not set in .env.", file=sys.stderr)
        sys.exit(1)

    if not os.path.isabs(creds_path):
        creds_path = os.path.join(os.getcwd(), creds_path)

    if not os.path.exists(creds_path):
        print(f"Error: Service account file not found at {creds_path}", file=sys.stderr)
        sys.exit(1)

    # Use the Display & Video 360 scope
    SCOPES = ['https://www.googleapis.com/auth/display-video']

    print(f"Authenticating using Service Account: {creds_path}", file=sys.stderr)
    creds = service_account.Credentials.from_service_account_file(
        creds_path, scopes=SCOPES
    )

    return build('displayvideo', 'v4', credentials=creds)

def list_partners(service):
    print("Listing Partners...", file=sys.stderr)
    try:
        partners_list = []
        next_page_token = None
        
        while True:
            results = service.partners().list(pageSize=100, pageToken=next_page_token).execute()
            partners_list.extend(results.get('partners', []))
            next_page_token = results.get('nextPageToken')
            if not next_page_token:
                break
        
        if not partners_list:
            print("No partners found.")
            return

        print(f"{'Partner ID':<15} | {'Name':<40} | {'Status'}")
        print("-" * 70)
        for partner in partners_list:
            pid = partner.get('partnerId', 'N/A')
            name = partner.get('displayName', 'N/A')
            status = partner.get('entityStatus', 'N/A')
            print(f"{pid:<15} | {name[:40]:<40} | {status}")
            
    except Exception as e:
        print(f"Error listing partners: {e}", file=sys.stderr)
        sys.exit(1)

def list_advertisers(service, partner_id):
    print(f"Listing Advertisers for Partner ID: {partner_id}...", file=sys.stderr)
    try:
        advertisers_list = []
        next_page_token = None
        
        while True:
            results = service.advertisers().list(partnerId=partner_id, pageSize=100, pageToken=next_page_token).execute()
            advertisers_list.extend(results.get('advertisers', []))
            next_page_token = results.get('nextPageToken')
            if not next_page_token:
                break
        
        if not advertisers_list:
            print(f"No advertisers found for Partner {partner_id}.")
            return

        print(f"{'Advertiser ID':<15} | {'Name':<40} | {'Status'}")
        print("-" * 70)
        for advertiser in advertisers_list:
            aid = advertiser.get('advertiserId', 'N/A')
            name = advertiser.get('displayName', 'N/A')
            status = advertiser.get('entityStatus', 'N/A')
            print(f"{aid:<15} | {name[:40]:<40} | {status}")
            
    except Exception as e:
        print(f"Error listing advertisers: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='List DV360 Partners and Advertisers')
    parser.add_argument('--partner-id', help='Partner ID to list advertisers for')
    args = parser.parse_args()

    service = get_service()

    if args.partner_id:
        list_advertisers(service, args.partner_id)
    else:
        list_partners(service)

if __name__ == '__main__':
    main()
