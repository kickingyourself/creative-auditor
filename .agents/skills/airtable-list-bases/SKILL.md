---
name: airtable-list-bases
description: Lists all Airtable bases the authenticated account has access to.
parameters: {}
---

# airtable-list-bases

Lists all Airtable bases that the authenticated account (via `AIRTABLE_REFRESH_TOKEN`) has access to.

### Prerequisites

Ensure you have the following environment variables set in your `.env` file:
- `AIRTABLE_CLIENT_ID`
- `AIRTABLE_REFRESH_TOKEN`
- `AIRTABLE_CLIENT_SECRET` (optional, only if using a confidential OAuth client)

### Command to Execute

```bash
python3 .agents/skills/airtable-list-bases/scripts/list_bases.py
```
