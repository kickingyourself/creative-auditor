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

    # CM360 scopes
    SCOPES = [
        'https://www.googleapis.com/auth/dfareporting',
        'https://www.googleapis.com/auth/dfatrafficking'
    ]

    creds = service_account.Credentials.from_service_account_file(
        creds_path, scopes=SCOPES
    )

    return build('dfareporting', 'v5', credentials=creds)

def list_user_profiles(service):
    print("Listing User Profiles...", file=sys.stderr)
    try:
        results = service.userProfiles().list().execute()
        profiles = results.get('items', [])
        
        if not profiles:
            print("No user profiles found. Ensure the service account has been added to CM360.")
            return

        print(f"{'Profile ID':<15} | {'User Name':<30} | {'Account Name'}")
        print("-" * 70)
        for profile in profiles:
            pid = profile.get('profileId', 'N/A')
            name = profile.get('userName', 'N/A')
            acc_name = profile.get('accountName', 'N/A')
            print(f"{pid:<15} | {name[:30]:<30} | {acc_name}")
            
    except Exception as e:
        print(f"Error listing user profiles: {e}", file=sys.stderr)
        sys.exit(1)

def list_advertisers(service, profile_id):
    print(f"Listing Advertisers for Profile ID: {profile_id}...", file=sys.stderr)
    try:
        advertisers_list = []
        next_page_token = None
        
        while True:
            results = service.advertisers().list(profileId=profile_id, pageToken=next_page_token).execute()
            advertisers_list.extend(results.get('advertisers', []))
            next_page_token = results.get('nextPageToken')
            if not next_page_token:
                break
        
        if not advertisers_list:
            print(f"No advertisers found for Profile {profile_id}.")
            return

        print(f"{'Advertiser ID':<15} | {'Name':<40} | {'Status'}")
        print("-" * 70)
        for advertiser in advertisers_list:
            aid = advertiser.get('id', 'N/A')
            name = advertiser.get('name', 'N/A')
            status = advertiser.get('status', 'N/A')
            print(f"{aid:<15} | {name[:40]:<40} | {status}")
            
    except Exception as e:
        print(f"Error listing advertisers: {e}", file=sys.stderr)
        sys.exit(1)

def list_accounts(service, profile_id):
    print(f"Listing Accounts for Profile ID: {profile_id}...", file=sys.stderr)
    try:
        # Note: In CM360 API, listing accounts usually returns the root account associated with the profile
        results = service.accounts().list(profileId=profile_id).execute()
        accounts = results.get('accounts', [])
        
        if not accounts:
            print(f"No accounts found for Profile {profile_id}.")
            return

        print(f"{'Account ID':<15} | {'Name':<40}")
        print("-" * 60)
        for acc in accounts:
            aid = acc.get('id', 'N/A')
            name = acc.get('name', 'N/A')
            print(f"{aid:<15} | {name[:40]}")
            
    except Exception as e:
        print(f"Error listing accounts: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='List CM360 User Profiles, Accounts, and Advertisers')
    parser.add_argument('--profile-id', help='Profile ID to list advertisers or accounts for')
    parser.add_argument('--list-accounts', action='store_true', help='List accounts instead of advertisers (requires --profile-id)')
    args = parser.parse_args()

    service = get_service()

    if args.profile_id:
        if args.list_accounts:
            list_accounts(service, args.profile_id)
        else:
            list_advertisers(service, args.profile_id)
    else:
        list_user_profiles(service)

if __name__ == '__main__':
    main()
