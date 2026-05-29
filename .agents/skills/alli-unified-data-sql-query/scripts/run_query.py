import argparse
import csv
import glob
import io
import os
import subprocess
import sys
import requests
from dotenv import load_dotenv, set_key

DOTENV_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '.env')


def get_access_token():
    import base64
    import json
    import time
    
    def is_jwt_valid(token):
        try:
            parts = token.split('.')
            if len(parts) != 3:
                return False
            payload_b64 = parts[1]
            payload_b64 += '=' * (-len(payload_b64) % 4)
            payload_json = base64.urlsafe_b64decode(payload_b64.encode('utf-8')).decode('utf-8')
            payload = json.loads(payload_json)
            exp = payload.get('exp')
            if exp and exp > time.time() + 30:
                return True
        except Exception:
            pass
        return False

    load_dotenv(DOTENV_PATH)

    client_id = os.getenv("ALLI_CLIENT_ID")
    refresh_token = os.getenv("ALLI_REFRESH_TOKEN")
    access_token = os.getenv("ALLI_ACCESS_TOKEN")

    if not client_id or not refresh_token:
        print("Error: ALLI_CLIENT_ID or ALLI_REFRESH_TOKEN not found in .env.", file=sys.stderr)
        print("Run `@[/pmg-cowork-login]alli` first to authenticate.", file=sys.stderr)
        sys.exit(1)

    if access_token and is_jwt_valid(access_token):
        return access_token

    try:
        resp = requests.post(
            "https://login.alliplatform.com/token",
            data={
                'grant_type': 'refresh_token',
                'client_id': client_id,
                'refresh_token': refresh_token,
            },
        )
        resp.raise_for_status()
        body = resp.json()
        access_token = body.get('access_token')
        new_refresh = body.get('refresh_token')
        
        if access_token:
            set_key(DOTENV_PATH, 'ALLI_ACCESS_TOKEN', access_token)
        if new_refresh and new_refresh != refresh_token:
            set_key(DOTENV_PATH, 'ALLI_REFRESH_TOKEN', new_refresh)
            
        return access_token
    except requests.exceptions.RequestException as e:
        print(f"Failed to refresh access token: {e}", file=sys.stderr)
        if hasattr(e, 'response') and e.response is not None:
            print(e.response.text, file=sys.stderr)
        sys.exit(1)


def resolve_sql_from_dbt(model_name):
    """Compile a dbt model and return the rendered SQL."""
    if not os.path.exists("dbt_project.yml"):
        print("Error: --dbt-model requires running from a dbt project root (dbt_project.yml not found).", file=sys.stderr)
        sys.exit(1)

    print(f"[*] Compiling dbt model: {model_name}")
    result = subprocess.run(
        ["dbt", "compile", "--select", model_name],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"Error: dbt compile failed.\n{result.stderr}", file=sys.stderr)
        sys.exit(1)

    # Search for the compiled file anywhere under target/compiled/
    pattern = os.path.join("target", "compiled", "**", f"{model_name}.sql")
    matches = glob.glob(pattern, recursive=True)
    if not matches:
        print(f"Error: Compiled SQL not found for model '{model_name}' under target/compiled/.", file=sys.stderr)
        sys.exit(1)

    compiled_path = matches[0]
    print(f"[*] Using compiled SQL: {compiled_path}")
    with open(compiled_path) as f:
        return f.read()


def execute_sql(client_id, sql, access_token):
    url = f"https://dataexplorer.alliplatform.com/api/v2/clients/{client_id}/sql/execute-query"
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'Accept': 'text/csv',
    }
    try:
        resp = requests.post(url, json={'sqlQuery': sql}, headers=headers)
        if resp.status_code == 204:
            print("Query succeeded but returned zero rows.")
            sys.exit(0)
        resp.raise_for_status()
        return resp.text
    except requests.exceptions.RequestException as e:
        print(f"Failed to execute SQL query: {e}", file=sys.stderr)
        if hasattr(e, 'response') and e.response is not None:
            print(e.response.text, file=sys.stderr)
        sys.exit(1)


def save_csv(csv_text, output_path):
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = list(reader)
    if not rows:
        print("No results returned.")
        return 0

    with open(output_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=reader.fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return len(rows)


def main():
    parser = argparse.ArgumentParser(
        description="Execute a SQL query via the Alli Unified Data API and save results to CSV."
    )
    parser.add_argument("--client-id", required=True, help="Alli client ID (used in the API URL)")
    parser.add_argument("--sql", help="Inline SQL query string")
    parser.add_argument("--query-file", help="Path to a .sql file")
    parser.add_argument("--dbt-model", help="dbt model name to compile and execute")
    parser.add_argument("--output", default="query_results.csv", help="Output CSV file path (default: query_results.csv)")
    args = parser.parse_args()

    sources = [s for s in [args.sql, args.query_file, args.dbt_model] if s]
    if len(sources) == 0:
        parser.error("Provide exactly one of --sql, --query-file, or --dbt-model.")
    if len(sources) > 1:
        parser.error("Only one of --sql, --query-file, or --dbt-model may be used at a time.")

    if args.sql:
        sql = args.sql
        print(f"[*] Source: inline SQL")
    elif args.query_file:
        if not os.path.exists(args.query_file):
            print(f"Error: File not found: {args.query_file}", file=sys.stderr)
            sys.exit(1)
        with open(args.query_file) as f:
            sql = f.read()
        print(f"[*] Source: {args.query_file}")
    else:
        sql = resolve_sql_from_dbt(args.dbt_model)

    print(f"[*] Client ID  : {args.client_id}")
    print(f"[*] Output file: {args.output}")
    print(f"[*] Note: API applies a 10k row limit automatically.")
    print()

    access_token = get_access_token()
    csv_text = execute_sql(args.client_id, sql, access_token)
    row_count = save_csv(csv_text, args.output)
    print(f"Saved {row_count} rows to {args.output}")


if __name__ == '__main__':
    main()
