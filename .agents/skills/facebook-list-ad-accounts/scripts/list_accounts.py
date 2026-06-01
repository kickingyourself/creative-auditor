#!/usr/bin/env python3
import os
import sys
import json
import urllib.request
import urllib.error

def load_env():
    """Simple parser to load .env into os.environ to avoid external dependencies."""
    cwd = os.getcwd()
    env_path = os.path.join(cwd, '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    # Only split on the first '='
                    parts = line.split('=', 1)
                    if len(parts) == 2:
                        key = parts[0].strip()
                        val = parts[1].strip()
                        # Unquote if necessary
                        if val.startswith('"') and val.endswith('"'):
                            val = val[1:-1]
                        elif val.startswith("'") and val.endswith("'"):
                            val = val[1:-1]
                        os.environ[key] = val

def main():
    load_env()
    
    access_token = os.environ.get("FB_ACCESS_TOKEN")
    if not access_token:
        print("Error: FB_ACCESS_TOKEN not found in .env.", file=sys.stderr)
        sys.exit(1)
        
    print("Fetching Facebook Ad Accounts...", file=sys.stderr)
    
    # Facebook Graph API endpoint
    api_version = "v19.0"
    url = f"https://graph.facebook.com/{api_version}/me/adaccounts?fields=name,account_id&access_token={access_token}"
    
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            
            accounts = data.get("data", [])
            print(f"Found {len(accounts)} Ad Account(s):\n" + "-" * 40)
            
            for index, account in enumerate(accounts, start=1):
                name = account.get("name", "Unknown Name")
                acc_id = account.get("account_id", "Unknown ID")
                # Add 'act_' prefix which is often used in FB API calls if it's missing just for display
                # or just display raw account_id
                print(f"{index}. {name} (ID: {acc_id})")
                
            print("-" * 40)
            
            if "paging" in data and "next" in data["paging"]:
                print("Note: There are more accounts available via pagination. Showing first page.")
                
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.reason}", file=sys.stderr)
        error_body = e.read().decode('utf-8')
        try:
            error_json = json.loads(error_body)
            print(f"Error Details: {error_json.get('error', {}).get('message', error_body)}", file=sys.stderr)
        except json.JSONDecodeError:
            print(f"Error Details: {error_body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"URL Error: {e.reason}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
