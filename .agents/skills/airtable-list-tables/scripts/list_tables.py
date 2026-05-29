import os
import sys
import base64
import argparse
import requests
from dotenv import load_dotenv, set_key

def find_dotenv():
    """Finds the .env file recursively walking up the directory tree."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    while current_dir != os.path.dirname(current_dir):
        potential_env = os.path.join(current_dir, '.env')
        if os.path.exists(potential_env):
            return potential_env
        current_dir = os.path.dirname(current_dir)
    return None

def get_access_token():
    """Refreshes the Airtable access token using the refresh token."""
    dotenv_path = find_dotenv()
    if not dotenv_path:
        print("Error: Could not locate .env file.", file=sys.stderr)
        sys.exit(1)
        
    load_dotenv(dotenv_path)

    client_id = os.getenv('AIRTABLE_CLIENT_ID')
    client_secret = os.getenv('AIRTABLE_CLIENT_SECRET')
    refresh_token = os.getenv('AIRTABLE_REFRESH_TOKEN')

    missing = []
    if not client_id: missing.append("AIRTABLE_CLIENT_ID")
    if not refresh_token: missing.append("AIRTABLE_REFRESH_TOKEN")

    if missing:
        print(f"Error: Missing variables in .env file: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    token_url = "https://airtable.com/oauth2/v1/token"
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token
    }

    if client_secret:
        # Base64 encode client_id:client_secret for Basic Auth
        credentials = f"{client_id}:{client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode('utf-8')).decode('utf-8')
        headers["Authorization"] = f"Basic {encoded_credentials}"
    else:
        # For public clients, pass client_id in the body
        data["client_id"] = client_id

    try:
        response = requests.post(token_url, headers=headers, data=data)
        response.raise_for_status()
        token_data = response.json()
        
        access_token = token_data.get('access_token')
        new_refresh_token = token_data.get('refresh_token')
        
        # Save rotated refresh token if returned and changed
        if new_refresh_token and new_refresh_token != refresh_token:
            set_key(dotenv_path, 'AIRTABLE_REFRESH_TOKEN', new_refresh_token)
            
        if access_token:
            return access_token
        else:
            print("Error: No access token returned from Airtable.", file=sys.stderr)
            sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f"Error refreshing Airtable token: {e}", file=sys.stderr)
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text, file=sys.stderr)
        sys.exit(1)

def list_tables(base_id, access_token):
    """Fetches and displays Airtable tables inside a base."""
    url = f"https://api.airtable.com/v0/meta/bases/{base_id}/tables"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        tables = data.get("tables", [])
        
        if not tables:
            print(f"No tables found in base {base_id}.")
            return

        # Display as Markdown Table
        print("| Table Name | Table ID | Description |")
        print("|---|---|---|")
        for table in tables:
            name = table.get("name", "N/A").replace('|', '\\|')
            table_id = table.get("id", "N/A")
            description = table.get("description", "N/A").replace('|', '\\|')
            print(f"| {name} | {table_id} | {description} |")

    except requests.exceptions.RequestException as e:
        print(f"Error fetching tables for base {base_id}: {e}", file=sys.stderr)
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text, file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="List tables within an Airtable base.")
    parser.add_argument('--base-id', required=True, help="The Airtable base ID (starts with app)")
    args = parser.parse_args()

    access_token = get_access_token()
    list_tables(args.base_id, access_token)

if __name__ == "__main__":
    main()
