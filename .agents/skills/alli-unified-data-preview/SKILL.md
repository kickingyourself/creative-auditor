---
name: alli-unified-data-preview
description: Fetches a synchronous preview/sample of semantic model data via the Unified Data API (UDA) v2.1. It accepts dimensions, measures, dates, and optional filters. If no model is provided, it automatically selects the client's default source.
---

# alli-unified-data-preview

This skill fetches a sample/preview of data using the synchronous `execute-query` endpoint of the Alli Unified Data API v2.1. 

### Prerequisites

Ensure you have run the following once before usage to authenticate:
```
@[/pmg-cowork-login]alli
```

### Command to Execute

```bash
python3 .agents/skills/alli-unified-data-preview/scripts/preview.py \
  --client-id <CLIENT_ID> \
  --model <MODEL_NAME> \
  --start-date "2025-01-01" \
  --end-date "2025-01-31" \
  --dimensions "channel,country" \
  --measures "ad_cost,ad_clicks" \
  --filters '[{"member": "channel", "operator": "equals", "values": ["Search Ads"]}]'
```

### Arguments
- `--client-id`: (Required) The ID of the client.
- `--model`: (Optional) The name of the semantic model (e.g., `unified`). If omitted, the skill will fetch the models list and use the `isAlliDefaultSource`.
- `--start-date`: (Required) The start date (YYYY-MM-DD).
- `--end-date`: (Required) The end date (YYYY-MM-DD).
- `--dimensions`: (Optional) Comma-separated list of dimensions.
- `--measures`: (Optional) Comma-separated list of measures.
- `--filters`: (Optional) A JSON string representing the filter array. Example: `'[{"member": "ad_cost", "operator": "greaterThan", "values": [400]}]'`


### Modification of this skill
If you are modifying this skill, you can reference the API documentation at https://dataexplorer.alliplatform.com/api-docs/#/Unified%20Data/unified-data_getModelMetadata
