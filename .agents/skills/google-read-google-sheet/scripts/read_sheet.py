#!/usr/bin/env python3
import os
import sys
import re

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

def extract_spreadsheet_id(input_str):
    """Extract ID from a full Google Sheets URL or return it directly if it's already an ID."""
    match = re.search(r'/d/([a-zA-Z0-9-_]+)', input_str)
    if match:
        return match.group(1)
    # Assume it's an ID if no match is found
    return input_str

def main():
    load_env()
    
    if len(sys.argv) < 2:
        print("Usage: python3 read_sheet.py <spreadsheet_url_or_id> [optional_range]")
        sys.exit(1)
        
    input_identifier = sys.argv[1]
    sheet_range = sys.argv[2] if len(sys.argv) > 2 else ""
    
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    refresh_token = os.environ.get('GOOGLE_REFRESH_TOKEN')

    if not all([client_id, client_secret, refresh_token]):
        print("Error: Required Google authentication environment variables are missing.", file=sys.stderr)
        print("Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN are set.", file=sys.stderr)
        sys.exit(1)
        
    SPREADSHEET_ID = extract_spreadsheet_id(input_identifier)
    SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']

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
        service = build('sheets', 'v4', credentials=creds)
        sheet = service.spreadsheets()
        
        # If no range provided, fetch sheet metadata to get the name of the first sheet and fetch all its data
        if not sheet_range:
            meta = sheet.get(spreadsheetId=SPREADSHEET_ID).execute()
            first_sheet_name = meta['sheets'][0]['properties']['title']
            sheet_range = first_sheet_name
            
        print(f"Fetching data from Spreadsheet ID: {SPREADSHEET_ID}, Range: {sheet_range}", file=sys.stderr)
        
        result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range=sheet_range).execute()
        values = result.get('values', [])
        
        if not values:
            print("No data found.", file=sys.stderr)
            return

        # Simple CSV-like format
        for row in values:
            print(','.join(['"' + str(cell).replace('"', '""') + '"' for cell in row]))
            
    except Exception as e:
        print(f"Google API Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
