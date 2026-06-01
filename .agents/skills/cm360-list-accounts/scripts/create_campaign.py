#!/usr/bin/env python3
import os
import sys
import argparse
from datetime import datetime

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

    # CM360 scopes
    SCOPES = ['https://www.googleapis.com/auth/dfareporting', 'https://www.googleapis.com/auth/dfatrafficking']

    creds = service_account.Credentials.from_service_account_file(
        creds_path, scopes=SCOPES
    )

    return build('dfareporting', 'v5', credentials=creds)

def get_or_create_landing_page(service, profile_id, advertiser_id, url, name):
    print(f"Checking for landing page: {url}", file=sys.stderr)
    try:
        # List landing pages to see if it exists
        results = service.advertiserLandingPages().list(
            profileId=profile_id, 
            advertiserIds=[advertiser_id],
            searchString=url
        ).execute()
        
        pages = results.get('landingPages', [])
        for page in pages:
            if page.get('url') == url:
                print(f"Found existing landing page ID: {page['id']}", file=sys.stderr)
                return page['id']
                
        # Not found, create it
        print(f"Creating new landing page for URL: {url}", file=sys.stderr)
        lp_body = {
            'name': f"Default LP - {name}",
            'url': url,
            'advertiserId': advertiser_id
        }
        new_lp = service.advertiserLandingPages().insert(profileId=profile_id, body=lp_body).execute()
        print(f"Created landing page ID: {new_lp['id']}", file=sys.stderr)
        return new_lp['id']
    except Exception as e:
        print(f"Error handling landing page: {e}", file=sys.stderr)
        sys.exit(1)

def create_campaign(service, profile_id, advertiser_id, name, lp_url, start_date, end_date):
    print(f"Creating CM360 Campaign: {name} (ACTIVE)", file=sys.stderr)
    
    # 1. Get/Create Landing Page ID
    lp_id = get_or_create_landing_page(service, profile_id, advertiser_id, lp_url, name)
    
    # 2. Build Campaign Resource
    # User requested status ACTIVE instead of PAUSED/Archived
    campaign_body = {
        'name': name,
        'advertiserId': advertiser_id,
        'startDate': start_date,
        'endDate': end_date,
        'defaultLandingPageId': lp_id,
        'archived': False  # SET TO ACTIVE AS REQUESTED
    }
    
    try:
        new_campaign = service.campaigns().insert(profileId=profile_id, body=campaign_body).execute()
        print(f"\nSUCCESS: Created Campaign '{new_campaign['name']}'")
        print(f"Campaign ID: {new_campaign['id']}")
        print(f"Status: ACTIVE (Archived=False)")
        print(f"Advertiser ID: {new_campaign['advertiserId']}")
        print(f"Date Range: {new_campaign['startDate']} to {new_campaign['endDate']}")
        return new_campaign
    except Exception as e:
        print(f"Error creating campaign: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='Create a new CM360 Campaign (will be created as ACTIVE)')
    parser.add_argument('--profile-id', required=True, help='CM360 Profile ID')
    parser.add_argument('--advertiser-id', required=True, help='Advertiser ID')
    parser.add_argument('--name', required=True, help='Campaign Name')
    parser.add_argument('--url', required=True, help='Default Landing Page URL')
    parser.add_argument('--start-date', required=True, help='Start Date (YYYY-MM-DD)')
    parser.add_argument('--end-date', required=True, help='End Date (YYYY-MM-DD)')
    
    args = parser.parse_args()
    
    # Simple date validation
    try:
        datetime.strptime(args.start_date, '%Y-%m-%d')
        datetime.strptime(args.end_date, '%Y-%m-%d')
    except ValueError:
        print("Error: Dates must be in YYYY-MM-DD format.", file=sys.stderr)
        sys.exit(1)

    service = get_service()
    create_campaign(service, args.profile_id, args.advertiser_id, args.name, args.url, args.start_date, args.end_date)

if __name__ == '__main__':
    main()
