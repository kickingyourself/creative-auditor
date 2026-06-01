import os
import requests
from dotenv import load_dotenv

def get_access_token():
    """Exchanges the SNAPCHAT_REFRESH_TOKEN for a short-lived access token."""
    # Find .env inside the workspace root (5 directories up from this script file)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dotenv_path = os.path.abspath(os.path.join(script_dir, '..', '..', '..', '..', '..', '.env'))
    load_dotenv(dotenv_path)

    CLIENT_ID = os.getenv('SNAPCHAT_CLIENT_ID')
    CLIENT_SECRET = os.getenv('SNAPCHAT_CLIENT_SECRET')
    REFRESH_TOKEN = os.getenv('SNAPCHAT_REFRESH_TOKEN')

    missing = []
    if not CLIENT_ID: missing.append("SNAPCHAT_CLIENT_ID")
    if not CLIENT_SECRET: missing.append("SNAPCHAT_CLIENT_SECRET")
    if not REFRESH_TOKEN: missing.append("SNAPCHAT_REFRESH_TOKEN")

    if missing:
        print(f"Error: Missing variables in .env file: {', '.join(missing)}")
        exit(1)

    token_url = "https://accounts.snapchat.com/login/oauth2/access_token"
    # Exchange using Confidential Client secret structure
    data = {
        'grant_type': 'refresh_token',
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'refresh_token': REFRESH_TOKEN
    }

    try:
        response = requests.post(token_url, data=data)
        response.raise_for_status()
        token_data = response.json()
        
        access_token = token_data.get('access_token')
        if access_token:
            return access_token
        else:
            print("Error: No access token returned from Snapchat.")
            exit(1)
    except requests.exceptions.RequestException as e:
        print(f"Error authenticating with Snapchat (Token Exchange): {e}")
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text)
        exit(1)

def list_ad_accounts(access_token):
    """Fetches organizations and nested ad accounts."""
    url = "https://adsapi.snapchat.com/v1/me/organizations?with_ad_accounts=true"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        organizations = data.get("organizations", [])
        
        # Display as table
        print(f"{'Account Name':<50} | {'Account ID'}")
        print("-" * 50 + "-+-" + "-" * 36)

        found = False
        for org in organizations:
            org_data = org.get("organization", {})
            ad_accounts = org_data.get("ad_accounts", [])
            for account in ad_accounts:
                acct_data = account
                name = acct_data.get("name", "Unknown Account")
                account_id = acct_data.get("id", "Unknown ID")
                
                # Truncate long names slightly if necessary
                if len(name) > 48:
                    name = name[:45] + "..."
                
                print(f"{name:<50} | {account_id}")
                found = True
        
        if not found:
            print(f"{'No ad accounts found':<50} | {'N/A'}")
            
    except requests.exceptions.RequestException as e:
        print(f"Error fetching organizations from Snapchat API: {e}")
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text)
        exit(1)


if __name__ == "__main__":
    token = get_access_token()
    list_ad_accounts(token)
