import os
import sys
import argparse
import requests
from dotenv import load_dotenv, set_key

dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..', '.env')
load_dotenv(dotenv_path)


def get_access_token(client_id, refresh_token):
    url = "https://slack.com/api/oauth.v2.access"
    data = {
        'client_id': client_id,
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token,
    }
    client_secret = os.getenv('SLACK_CLIENT_SECRET')
    if client_secret:
        data['client_secret'] = client_secret

    try:
        response = requests.post(url, data=data)
        response.raise_for_status()
        token_data = response.json()

        if token_data.get('ok'):
            new_access_token = token_data.get('access_token')
            new_refresh_token = token_data.get('refresh_token')
            if new_refresh_token:
                set_key(dotenv_path, 'SLACK_REFRESH_TOKEN', new_refresh_token)
            return new_access_token
        else:
            error_msg = token_data.get('error', '')
            if 'invalid_refresh_token' in error_msg or 'invalid_grant' in error_msg:
                return refresh_token
            print(f"Slack token refresh failed: {error_msg}", file=sys.stderr)
            return None
    except Exception as e:
        print(f"Exception during Slack token refresh: {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(description="TODO: describe what this skill does")
    # TODO: add --param arguments here, e.g.:
    # parser.add_argument('--channel', required=True, help="Slack channel ID or name")
    args = parser.parse_args()

    refresh_token_env = os.getenv('SLACK_REFRESH_TOKEN')
    client_id = os.getenv('SLACK_CLIENT_ID')

    if not refresh_token_env or not client_id:
        print("Error: SLACK_REFRESH_TOKEN and SLACK_CLIENT_ID must be set in .env.", file=sys.stderr)
        sys.exit(1)

    if refresh_token_env.startswith(("xoxp-", "xoxe.xoxp-", "xoxb-")):
        access_token = refresh_token_env
    else:
        access_token = get_access_token(client_id, refresh_token_env)

    if not access_token:
        print("Error: Could not obtain a valid Slack access token.", file=sys.stderr)
        sys.exit(1)

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    # TODO: make your Slack API call here, e.g.:
    # api_url = "https://slack.com/api/conversations.list"
    # response = requests.get(api_url, headers=headers, params={'limit': 200})
    # response.raise_for_status()
    # data = response.json()
    # if not data.get('ok'):
    #     print(f"Slack API error: {data.get('error')}", file=sys.stderr)
    #     sys.exit(1)
    # items = data.get('channels', [])

    # TODO: update column headers and field names to match the actual response
    print("| Name | ID | Members |")
    print("|---|---|---|")
    # for item in items:
    #     print(f"| {item.get('name')} | {item.get('id')} | {item.get('num_members', 0)} |")


if __name__ == '__main__':
    main()
