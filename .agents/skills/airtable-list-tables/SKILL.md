---
name: airtable-list-tables
description: Lists all tables within a specific Airtable base.
parameters:
  base-id:
    type: string
    description: The Airtable base ID (starts with app)
    required: true
---

# airtable-list-tables

Lists all tables within a specific Airtable base.

### Prerequisites

Ensure you have the following environment variables set in your `.env` file:
- `AIRTABLE_CLIENT_ID`
- `AIRTABLE_REFRESH_TOKEN`
- `AIRTABLE_CLIENT_SECRET` (optional, only if using a confidential OAuth client)

### Command to Execute

```bash
python3 .agents/skills/airtable-list-tables/scripts/list_tables.py --base-id "{base_id}"
```
