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
    cwd = os.getcwd()
    env_path = os.path.join(cwd, '.env')
    if not os.path.exists(env_path):
        env_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..', '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    parts = line.split('=', 1)
                    if len(parts) == 2:
                        key = parts[0].strip()
                        val = parts[1].strip()
                        if val.startswith('"') and val.endswith('"'):
                            val = val[1:-1]
                        elif val.startswith("'") and val.endswith("'"):
                            val = val[1:-1]
                        os.environ[key] = val


def main():
    load_env()

    parser = argparse.ArgumentParser(description="TODO: describe what this skill does")
    # TODO: add --param arguments here, e.g.:
    # parser.add_argument('--spreadsheet-id', required=True, help="Google Sheets spreadsheet ID")
    args = parser.parse_args()

    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    refresh_token = os.environ.get('GOOGLE_REFRESH_TOKEN')

    if not all([client_id, client_secret, refresh_token]):
        print("Error: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN must all be set in .env.", file=sys.stderr)
        sys.exit(1)

    # TODO: update the scope to match the API you are calling
    # Common scopes:
    #   Calendar:  https://www.googleapis.com/auth/calendar
    #   Sheets:    https://www.googleapis.com/auth/spreadsheets
    #   Gmail:     https://www.googleapis.com/auth/gmail.readonly
    #   Drive:     https://www.googleapis.com/auth/drive
    SCOPES = ['https://www.googleapis.com/auth/TODO_SCOPE']

    try:
        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=SCOPES,
        )

        # TODO: update the service name and version, e.g. ('sheets', 'v4'), ('calendar', 'v3'), ('gmail', 'v1')
        service = build('TODO_SERVICE', 'TODO_VERSION', credentials=creds)

        # TODO: make your API call here, e.g.:
        # result = service.spreadsheets().values().get(
        #     spreadsheetId=args.spreadsheet_id,
        #     range='Sheet1!A1:Z100'
        # ).execute()
        # rows = result.get('values', [])

        # TODO: update column headers and field names to match the actual response
        print("| Column A | Column B | Column C |")
        print("|---|---|---|")
        # for row in rows:
        #     print(f"| {row[0] if len(row) > 0 else ''} | {row[1] if len(row) > 1 else ''} | {row[2] if len(row) > 2 else ''} |")

    except Exception as e:
        print(f"Google API Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
