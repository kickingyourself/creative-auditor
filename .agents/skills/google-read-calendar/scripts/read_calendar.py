#!/usr/bin/env python3
import os
import sys
import argparse
from datetime import datetime, timedelta, timezone

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
    
    # Calculate default start and end dates (current week: Monday to Sunday)
    today = datetime.now(timezone.utc).date()
    # Monday is 0, Sunday is 6
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    
    default_start = start_of_week.strftime('%Y-%m-%d')
    default_end = end_of_week.strftime('%Y-%m-%d')

    parser = argparse.ArgumentParser(description="Read Google Calendar events.")
    parser.add_argument('--start-date', type=str, help="Start date in YYYY-MM-DD format.", default=default_start)
    parser.add_argument('--end-date', type=str, help="End date in YYYY-MM-DD format.", default=default_end)
    parser.add_argument('--calendar-id', type=str, help="Calendar ID to read.", default="primary")
    
    args = parser.parse_args()
    
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    refresh_token = os.environ.get('GOOGLE_REFRESH_TOKEN')

    if not all([client_id, client_secret, refresh_token]):
        print("Error: Required Google authentication environment variables are missing.", file=sys.stderr)
        print("Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN are set.", file=sys.stderr)
        sys.exit(1)
        
    SCOPES = ['https://www.googleapis.com/auth/calendar']

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
        service = build('calendar', 'v3', credentials=creds)
        
        try:
            # Parse YYYY-MM-DD to RFC3339 timestamp
            time_min = datetime.strptime(args.start_date, '%Y-%m-%d').replace(tzinfo=timezone.utc).isoformat()
            
            # For end date, we typically want the very end of the day, so we add 1 day and get the start of that day 
            # or just set the time to 23:59:59
            time_max = (datetime.strptime(args.end_date, '%Y-%m-%d') + timedelta(days=1)).replace(tzinfo=timezone.utc).isoformat()
            
        except ValueError:
            print("Error: Invalid date format. Please use YYYY-MM-DD.", file=sys.stderr)
            sys.exit(1)
        
        print(f"Fetching events from {args.start_date} to {args.end_date}...", file=sys.stderr)
            
        events_result = service.events().list(
            calendarId=args.calendar_id, 
            timeMin=time_min,
            timeMax=time_max, 
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])

        if not events:
            print("No upcoming events found.", file=sys.stderr)
            return

        print("| Event ID | Start | End | Summary | Location |")
        print("|---|---|---|---|---|")

        for event in events:
            start = event['start'].get('dateTime', event['start'].get('date'))
            end = event['end'].get('dateTime', event['end'].get('date'))
            summary = event.get('summary', 'No Summary')
            location = event.get('location', '')
            
            # Escape pipe characters and newlines for markdown table compatibility
            start = start.replace('|', '\\|').replace('\n', ' ').replace('\r', '')
            end = end.replace('|', '\\|').replace('\n', ' ').replace('\r', '')
            summary = summary.replace('|', '\\|').replace('\n', ' ').replace('\r', '')
            location = location.replace('|', '\\|').replace('\n', ' ').replace('\r', '')
            
            print(f"| {event['id']} | {start} | {end} | {summary} | {location} |")
            
    except Exception as e:
        print(f"Google API Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
