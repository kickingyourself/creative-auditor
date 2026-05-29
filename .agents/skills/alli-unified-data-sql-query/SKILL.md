---
name: alli-data-sql-query
description: Execute a user-provided SQL query via the Alli Unified Data SQL API and save results to a CSV file. Accepts inline SQL, a .sql file, or a dbt model name (Jinja compiled via dbt).
parameters:
  client-id:
    type: string
    description: The Alli client ID (used in the API URL). Find it with the alli-list-clients skill.
    required: true
  sql:
    type: string
    description: Inline SQL query string to execute.
    required: false
  query-file:
    type: string
    description: Path to a .sql file containing the query to execute.
    required: false
  dbt-model:
    type: string
    description: dbt model name to compile (Jinja rendered) and execute. Requires dbt to be installed and run from within the dbt project directory.
    required: false
  output:
    type: string
    description: Output CSV file path. Defaults to query_results.csv in the current directory.
    required: false
---

# alli-data-sql-query

Execute a user-provided SQL query via the Alli Unified Data SQL API and save results to a CSV file. The query can be provided as an inline string, a `.sql` file, or a dbt model name (Jinja templates are compiled via `dbt compile` before execution).

### Prerequisites

Ensure you have authenticated first:
```
@[/pmg-cowork-login]alli
```

For dbt model execution, dbt must be installed and the command must be run from within the dbt project root (where `dbt_project.yml` lives).

### Command to Execute

```bash
python3 .agents/skills/alli-data-sql-query/scripts/run_query.py \
  --client-id "<CLIENT_ID>" \
  [--sql "SELECT ..."] \
  [--query-file path/to/query.sql] \
  [--dbt-model my_model_name] \
  [--output results.csv]
```

Exactly one of `--sql`, `--query-file`, or `--dbt-model` must be provided.

### Arguments

- `--client-id`: (Required) The Alli client ID (numeric). Use `alli-list-clients` to find it.
- `--sql`: (Optional) An inline SQL string. Wrap in quotes when passing from the shell.
- `--query-file`: (Optional) Path to a `.sql` file to read and execute.
- `--dbt-model`: (Optional) A dbt model name. The skill runs `dbt compile --select <model>`, locates the compiled SQL in `target/compiled/`, and executes it against Alli.
- `--output`: (Optional) Path for the output CSV file. Defaults to `query_results.csv`.

### Notes

- The Alli SQL API automatically applies a **10k row limit** — do not add a manual `LIMIT` unless you want fewer rows.
- dbt Jinja (refs, sources, macros) is resolved by `dbt compile` before the SQL reaches Alli, so the executed query is plain SQL with fully qualified relation names.
- The refresh token is rotated automatically after each successful token exchange.
