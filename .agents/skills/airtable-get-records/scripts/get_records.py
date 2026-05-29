import os
import sys
import base64
import argparse
import urllib.parse
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

def fetch_records(base_id, table_name, access_token, max_records=None):
    """Fetches records from an Airtable table with pagination support."""
    encoded_table_name = urllib.parse.quote(table_name)
    url = f"https://api.airtable.com/v0/{base_id}/{encoded_table_name}"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    records = []
    offset = None
    
    while True:
        params = {}
        if offset:
            params['offset'] = offset
            
        if max_records:
            remaining = max_records - len(records)
            if remaining <= 0:
                break
            params['pageSize'] = min(remaining, 100)
            
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            page_records = data.get("records", [])
            records.extend(page_records)
            
            offset = data.get("offset")
            if not offset or (max_records and len(records) >= max_records):
                break
        except requests.exceptions.RequestException as e:
            print(f"Error fetching records from table {table_name}: {e}", file=sys.stderr)
            if hasattr(e, 'response') and e.response is not None:
                 print(e.response.text, file=sys.stderr)
            sys.exit(1)
            
    return records

def display_records(records):
    """Formats and prints Airtable records dynamically as a markdown table."""
    if not records:
        print("No records found in this table.")
        return

    # Extract all unique field keys present in the response
    field_keys = []
    for record in records:
        fields = record.get('fields', {})
        for key in fields.keys():
            if key not in field_keys:
                field_keys.append(key)

    # Print markdown table headers
    header_row = "| Record ID | " + " | ".join(field_keys) + " |"
    separator_row = "|---| " + " | ".join(["---"] * len(field_keys)) + " |"
    print(header_row)
    print(separator_row)

    # Print markdown table rows
    for record in records:
        rec_id = record.get('id', 'N/A')
        fields = record.get('fields', {})
        row_values = [rec_id]
        for key in field_keys:
            val = fields.get(key, '')
            if isinstance(val, list):
                val_str = ", ".join(str(v) for v in val)
            else:
                val_str = str(val)
            # Escape pipe character to prevent breaking markdown formatting
            val_str = val_str.replace('|', '\\|')
            row_values.append(val_str)
        print("| " + " | ".join(row_values) + " |")

def main():
    parser = argparse.ArgumentParser(description="Fetch and display records from an Airtable table.")
    parser.add_argument('--base-id', required=True, help="The Airtable base ID (starts with app)")
    parser.add_argument('--table-name', required=True, help="The table name or ID")
    parser.add_argument('--max-records', type=int, default=100, help="Optional maximum number of records to retrieve (default is 100)")
    args = parser.parse_args()

    access_token = get_access_token()
    records = fetch_records(args.base_id, args.table_name, access_token, args.max_records)
    display_records(records)

if __name__ == "__main__":
    main()
