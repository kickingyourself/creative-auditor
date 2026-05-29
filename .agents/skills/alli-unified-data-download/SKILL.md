---
name: alli-unified-data-download
description: Exports semantic model data asynchronously via the Unified Data API (UDA) v2.1. This skill triggers an export, polls the server for completion, and downloads the resulting CSV data.
---

# alli-unified-data-download

This skill executes an asynchronous data export using the `export-data` endpoint of the Alli Unified Data API v2.1. It handles polling the API until the job completes and downloads the CSV file from S3.

### Prerequisites

Ensure you have run the following once before usage to authenticate:
```
@[/pmg-cowork-login]alli
```

### Command to Execute

```bash
python3 .agents/skills/alli-unified-data-download/scripts/download.py \
  --client-id <CLIENT_ID> \
  --model <MODEL_NAME> \
  --start-date "2025-01-01" \
  --end-date "2025-01-31" \
  --dimensions "channel,country" \
  --measures "ad_cost,ad_clicks" \
  --filters '[{"member": "channel", "operator": "equals", "values": ["Search Ads"]}]' \
  --output-file "report.csv"
```

### Arguments
- `--client-id`: (Required) The ID of the client.
- `--model`: (Optional) The name of the semantic model (e.g., `unified`). If omitted, the skill will use the `isAlliDefaultSource`.
- `--start-date`: (Required) The start date (YYYY-MM-DD).
- `--end-date`: (Required) The end date (YYYY-MM-DD).
- `--dimensions`: (Optional) Comma-separated list of dimensions.
- `--measures`: (Optional) Comma-separated list of measures.
- `--filters`: (Optional) A JSON string representing the filter array. Example: `'[{"member": "ad_cost", "operator": "greaterThan", "values": [400]}]'`
- `--output-file`: (Optional) Path to save the downloaded CSV. If omitted, and the file is under 5MB, it prints to standard output.


### Modification of this skill
If you are modifying this skill, you can reference the API documentation at https://dataexplorer.alliplatform.com/api-docs/#/Unified%20Data/unified-data_getModelMetadata
