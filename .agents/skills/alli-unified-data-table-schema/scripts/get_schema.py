import argparse
import csv
import io
import os
import sys
import requests
from dotenv import load_dotenv

DOTENV_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '.env')

DATABASE_TYPES = ["snowflake", "bigquery", "redshift"]


def get_access_token():
    import base64
    import json
    import time
    from dotenv import load_dotenv, set_key
    
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
        print("Error: ALLI_CLIENT_ID or ALLI_REFRESH_TOKEN not found in .env.")
        print("Please run `@[/pmg-cowork-login]alli` first to authenticate.")
        sys.exit(1)

    if access_token and is_jwt_valid(access_token):
        return access_token

    token_data = {
        'grant_type': 'refresh_token',
        'client_id': client_id,
        'refresh_token': refresh_token,
    }

    try:
        resp = requests.post("https://login.alliplatform.com/token", data=token_data)
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
        print(f"Failed to refresh access token: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(e.response.text)
        sys.exit(1)


def schema_variants(client_slug):
    """Return the three Alli schema variants for a client slug."""
    return [client_slug, f"{client_slug}_core", f"{client_slug}_custom"]


def build_query(database_type, client_slug, table=None):
    """
    Build an INFORMATION_SCHEMA.COLUMNS query scoped to Alli's client_slug schema
    naming conventions. Results are capped at 10k rows server-side.

    Alli relation syntax:
      generic  : client_slug.table_name  /  client_slug.functionName(col1, col2)
      snowflake: "client_slug"."table_name"  /  "client_slug"."functionName"(col1, col2)
    """
    variants = schema_variants(client_slug)
    variants_list = ", ".join(f"'{s}'" for s in variants)

    if database_type == "snowflake":
        # INFORMATION_SCHEMA itself uses standard identifiers; quoted form applies
        # when referencing actual relations, e.g. "client_slug"."table_name"
        clauses = [f"TABLE_SCHEMA IN ({variants_list})"]
        if table:
            clauses.append(f"TABLE_NAME = '{table}'")
        where = "WHERE " + " AND ".join(clauses)
        return (
            "SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE\n"
            "FROM INFORMATION_SCHEMA.COLUMNS\n"
            f"{where}\n"
            "ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION"
        )

    elif database_type == "bigquery":
        # BigQuery scopes INFORMATION_SCHEMA to a dataset (= client_slug).
        # _core and _custom variants each need their own UNION leg.
        legs = []
        for variant in variants:
            clauses = []
            if table:
                clauses.append(f"TABLE_NAME = '{table}'")
            where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
            legs.append(
                f"SELECT '{variant}' AS TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE\n"
                f"FROM `{variant}`.INFORMATION_SCHEMA.COLUMNS\n"
                f"{where}"
            )
        return (
            "\nUNION ALL\n".join(legs) +
            "\nORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION"
        )

    elif database_type == "redshift":
        clauses = [f"TABLE_SCHEMA IN ({variants_list})"]
        if table:
            clauses.append(f"TABLE_NAME = '{table}'")
        where = "WHERE " + " AND ".join(clauses)
        return (
            "SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE\n"
            "FROM INFORMATION_SCHEMA.COLUMNS\n"
            f"{where}\n"
            "ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION"
        )


def execute_sql(client_id, sql, access_token):
    # Note: the API automatically applies a 10k row limit to all queries.
    url = f"https://dataexplorer.alliplatform.com/api/v2/clients/{client_id}/sql/execute-query"
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'Accept': 'text/csv',
    }
    payload = {'sqlQuery': sql}

    try:
        resp = requests.post(url, json=payload, headers=headers)
        if resp.status_code == 204:
            print("Query succeeded but returned zero rows.")
            sys.exit(0)
        resp.raise_for_status()
        return resp.text
    except requests.exceptions.RequestException as e:
        print(f"Failed to execute SQL query: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(e.response.text)
        sys.exit(1)


def print_markdown_table(csv_text):
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = list(reader)
    if not rows:
        print("No results returned.")
        return

    headers = reader.fieldnames
    col_widths = {h: len(h) for h in headers}
    for row in rows:
        for h in headers:
            col_widths[h] = max(col_widths[h], len(row.get(h, '') or ''))

    def fmt_row(cells):
        return '| ' + ' | '.join(str(c).ljust(col_widths[h]) for h, c in zip(headers, cells)) + ' |'

    print(fmt_row(headers))
    print('| ' + ' | '.join('-' * col_widths[h] for h in headers) + ' |')
    for row in rows:
        print(fmt_row([row.get(h, '') or '' for h in headers]))


def check_dbt_environment():
    """Warn if we appear to be inside a dbt project without dbt skills installed."""
    cwd = os.getcwd()
    is_dbt_project = os.path.exists(os.path.join(cwd, 'dbt_project.yml'))
    if not is_dbt_project:
        return

    skill_roots = [
        os.path.join(cwd, '.agents', 'skills'),
        os.path.join(cwd, '.claude', 'skills'),
    ]
    has_dbt_skill = any(
        any('dbt' in d.lower() for d in os.listdir(root))
        for root in skill_roots
        if os.path.isdir(root)
    )

    print("⚠️  dbt project detected (dbt_project.yml found).")
    if not has_dbt_skill:
        print("   No dbt skill found in .agents/skills/ or .claude/skills/.")
        print("   Consider installing a dbt skill for model introspection and lineage support.")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Fetch table/column schema via Alli Unified Data SQL API"
    )
    parser.add_argument("--client-id", required=True, help="Alli client ID (used in the API URL)")
    parser.add_argument(
        "--client-slug",
        required=True,
        help="Alli client slug (used as the schema prefix in SQL, e.g. acme → acme.table_name)",
    )
    parser.add_argument(
        "--database-type",
        required=True,
        choices=DATABASE_TYPES,
        help="Database engine: snowflake, bigquery, or redshift",
    )
    parser.add_argument("--table", required=False, help="Filter to a specific table name")
    args = parser.parse_args()

    check_dbt_environment()

    variants = schema_variants(args.client_slug)
    print(f"[*] Database type  : {args.database_type}")
    print(f"[*] Schema variants: {', '.join(variants)}")
    if args.table:
        print(f"[*] Table filter   : {args.table}")
    print(f"[*] Note: API applies a 10k row limit automatically.")
    print()

    access_token = get_access_token()
    sql = build_query(args.database_type, args.client_slug, table=args.table)
    csv_text = execute_sql(args.client_id, sql, access_token)
    print_markdown_table(csv_text)


if __name__ == '__main__':
    main()
