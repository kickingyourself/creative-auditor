---
name: airtable-get-records
description: Retrieves and prints records from a specific table within an Airtable base.
parameters:
  base-id:
    type: string
    description: The Airtable base ID (starts with app)
    required: true
  table-name:
    type: string
    description: The name or ID of the table to retrieve records from
    required: true
  max-records:
    type: integer
    description: Optional maximum number of records to retrieve (default is 100)
    required: false
---

# airtable-get-records

Retrieves and prints records from a specific table within an Airtable base.

### Prerequisites

Ensure you have the following environment variables set in your `.env` file:
- `AIRTABLE_CLIENT_ID`
- `AIRTABLE_REFRESH_TOKEN`
- `AIRTABLE_CLIENT_SECRET` (optional, only if using a confidential OAuth client)

### Command to Execute

```bash
python3 .agents/skills/airtable-get-records/scripts/get_records.py --base-id "{base_id}" --table-name "{table_name}" --max-records "{max_records}"
```
