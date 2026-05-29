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
    
    parser = argparse.ArgumentParser(description="Read Gmail messages.")
    parser.add_argument('--start-date', type=str, help="Start date in YYYY/MM/DD format.", default=None)
    parser.add_argument('--end-date', type=str, help="End date in YYYY/MM/DD format.", default=None)
    parser.add_argument('--max-results', type=int, help="Maximum number of messages to fetch.", default=10)
    parser.add_argument('--query', type=str, help="Optional raw Gmail search query.", default=None)
    parser.add_argument('--all-mail', action='store_true', help="Search all mail instead of just the INBOX.")
    
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
        
        query_parts = []
        if args.start_date:
            query_parts.append(f"after:{args.start_date}")
        if args.end_date:
            query_parts.append(f"before:{args.end_date}")
        if args.query:
            query_parts.append(args.query)
            
        q = " ".join(query_parts) if query_parts else ""
        
        if q:
            print(f"Fetching messages matching query: '{q}'", file=sys.stderr)
        else:
            print("Fetching most recent messages...", file=sys.stderr)
            
        kwargs = {
            'userId': 'me',
            'maxResults': args.max_results,
            'q': q
        }
        if not args.all_mail:
            kwargs['labelIds'] = ['INBOX']
            
        results = service.users().messages().list(**kwargs).execute()
        messages = results.get('messages', [])

        if not messages:
            print("No messages found.", file=sys.stderr)
            return

        print("| ID | Date | From | Subject | Snippet |")
        print("|---|---|---|---|---|")

        for index, message in enumerate(messages):
            msg = service.users().messages().get(userId='me', id=message['id'], format='metadata', metadataHeaders=['Subject', 'From', 'Date']).execute()
            headers = msg['payload']['headers']
            
            subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), 'No Subject')
            sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), 'No Sender')
            date = next((h['value'] for h in headers if h['name'].lower() == 'date'), 'No Date')
            snippet = msg.get('snippet', '')
            
            # Escape pipe characters and newlines for markdown table compatibility
            subject = subject.replace('|', '\\|').replace('\n', ' ').replace('\r', '')
            sender = sender.replace('|', '\\|').replace('\n', ' ').replace('\r', '')
            date = date.replace('|', '\\|').replace('\n', ' ').replace('\r', '')
            snippet = snippet.replace('|', '\\|').replace('\n', ' ').replace('\r', '')
            
            print(f"| {message['id']} | {date} | {sender} | {subject} | {snippet} |")
            
    except Exception as e:
        print(f"Google API Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
