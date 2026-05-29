import os
import sys
import argparse
import requests
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..', '.env')
load_dotenv(dotenv_path)


def main():
    parser = argparse.ArgumentParser(description="TODO: describe what this skill does")
    # TODO: add --param arguments here, e.g.:
    # parser.add_argument('--account-id', required=True, help="The account ID to query")
    args = parser.parse_args()

    # TODO: replace API_TOKEN with the actual env var name for this service
    api_token = os.getenv("API_TOKEN")

    if not api_token:
        print("Error: API_TOKEN not found in .env.", file=sys.stderr)
        sys.exit(1)

    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }

    # TODO: set the correct base URL and endpoint for this service
    api_url = "https://api.example.com/v1/TODO_ENDPOINT"

    try:
        response = requests.get(api_url, headers=headers)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        print(f"API request failed: {e}", file=sys.stderr)
        if hasattr(e, 'response') and e.response is not None:
            print(e.response.text, file=sys.stderr)
        sys.exit(1)

    # TODO: update to match the actual response structure
    items = data if isinstance(data, list) else data.get('data', data.get('items', []))

    if not items:
        print("No results found.")
        sys.exit(0)

    # TODO: update column headers and field names to match the actual response
    print("| Name | ID | Status |")
    print("|---|---|---|")
    for item in items:
        name = item.get('name', 'N/A')
        item_id = item.get('id', 'N/A')
        status = item.get('status', 'N/A')
        print(f"| {name} | {item_id} | {status} |")


if __name__ == '__main__':
    main()
