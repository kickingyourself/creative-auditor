---
name: alli-data-table-schema
description: Fetches table and column definitions for a client's database by executing INFORMATION_SCHEMA queries via the Alli Unified Data SQL API. Scopes to all three Alli schema variants (client_slug, client_slug_core, client_slug_custom). Supports Snowflake, BigQuery, and Redshift syntax.
parameters:
  client-id:
    type: string
    description: The Alli client ID (used in the API URL). Find it with the alli-list-clients skill.
    required: true
  client-slug:
    type: string
    description: The Alli client slug used as the schema prefix in SQL (e.g. acme → acme.table_name, "acme"."table_name" in Snowflake).
    required: true
  database-type:
    type: string
    description: The database engine to query against. Must be one of snowflake, bigquery, redshift.
    required: true
  table:
    type: string
    description: Filter results to a specific table name.
    required: false
---

# alli-data-table-schema

Fetches table and column definitions for a client's database using the Alli Unified Data SQL execution API. Automatically scopes the query to all three Alli schema naming variants: `client_slug`, `client_slug_core`, and `client_slug_custom`.

### Prerequisites

Ensure you have run the following once before usage to authenticate:
```
@[/pmg-cowork-login]alli
```

If running inside a dbt project, the script will detect `dbt_project.yml` and warn if no dbt skill is installed.

### Command to Execute

```bash
python3 .agents/skills/alli-data-table-schema/scripts/get_schema.py \
  --client-id <CLIENT_ID> \
  --client-slug <CLIENT_SLUG> \
  --database-type <snowflake|bigquery|redshift> \
  [--table <TABLE_NAME>]
```

### Arguments
- `--client-id`: (Required) The Alli client ID (numeric). Use `alli-list-clients` to find it.
- `--client-slug`: (Required) The client slug used in SQL relation names. Use `alli-list-clients` to find it.
- `--database-type`: (Required) The database engine: `snowflake`, `bigquery`, or `redshift`.
- `--table`: (Optional) Filter output to a single table name.

### Alli SQL Relation Syntax

Alli uses `client_slug` as the schema/dataset namespace for all SQL relations:

| Engine | Table reference | Function reference |
|---|---|---|
| BigQuery / Redshift | `client_slug.table_name` | `client_slug.functionName(col1, col2)` |
| Snowflake | `"client_slug"."table_name"` | `"client_slug"."functionName"(col1, col2)` |

The `_core` and `_custom` suffix variants (`client_slug_core`, `client_slug_custom`) carry shared permissions and are always included in schema queries.

### Notes
- The API automatically applies a **10k row limit** to all SQL executions — do not add a manual `LIMIT` clause.
- BigQuery queries each schema variant (`client_slug`, `client_slug_core`, `client_slug_custom`) separately and `UNION ALL`s the results, since BigQuery scopes `INFORMATION_SCHEMA` per dataset.
- Results are streamed as CSV from the API and printed as a markdown table.
