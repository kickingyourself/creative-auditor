#!/usr/bin/env python3
import os
import sys
import argparse

try:
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
except ImportError:
    print("Error: Missing required Python packages.", file=sys.stderr)
    print("Run: pip3 install google-api-python-client google-auth-httplib2 google-auth-oauthlib", file=sys.stderr)
    sys.exit(1)

def load_env():
    """Simple parser to load .env into os.environ."""
    cwd = os.getcwd()
    env_path = os.path.join(cwd, '.env')
    if not os.path.exists(env_path):
        env_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '.env')
        
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

def main():
    load_env()
    
    parser = argparse.ArgumentParser(description="Archive Gmail messages by removing the INBOX label.")
    parser.add_argument('message_ids', metavar='N', type=str, nargs='+', help="One or more Gmail Message IDs to archive.")
    
    args = parser.parse_args()
    
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    refresh_token = os.environ.get('GOOGLE_REFRESH_TOKEN')

    if not all([client_id, client_secret, refresh_token]):
        print("Error: Required Google authentication environment variables are missing.", file=sys.stderr)
        print("Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN are set.", file=sys.stderr)
        sys.exit(1)
        
    SCOPES = ['https://mail.google.com/']

    print("Authenticating using Google OAuth Refresh Token...", file=sys.stderr)
    try:
        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=SCOPES
        )
        service = build('gmail', 'v1', credentials=creds)
        
        message_ids = args.message_ids
        print(f"Archiving {len(message_ids)} message(s)...", file=sys.stderr)
        
        # batchModify efficiently applies or removes labels for multiple messages
        body = {
            'ids': message_ids,
            'removeLabelIds': ['INBOX']
        }
        
        service.users().messages().batchModify(userId='me', body=body).execute()
        
        print("Successfully archived the messages.", file=sys.stderr)
        
    except Exception as e:
        print(f"Google API Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
