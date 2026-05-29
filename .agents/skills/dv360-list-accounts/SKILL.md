---
name: dv360-list-accounts
description: This skill allows you to list all Display & Video 360 (DV360) Partners you have access to, as well as the Advertisers under a specific Partner.
---

# List DV360 Partners and Advertisers

This skill allows you to list all Display & Video 360 (DV360) Partners you have access to, as well as the Advertisers under a specific Partner.

## Prerequisites

- Service Account key file path must be set in `GOOGLE_APPLICATION_CREDENTIALS` in the `.env` file.
- The service account email must be added to DV360 with appropriate permissions (Partner/Advertiser access).

## Usage

### List all Partners

```bash
python3 .agents/skills/dv360-list-accounts/scripts/list_accounts.py
```

### List Advertisers for a specific Partner

```bash
python3 .agents/skills/dv360-list-accounts/scripts/list_accounts.py --partner-id <PARTNER_ID>
```

## Output

The skill will output a list of Partners or Advertisers in a formatted table, including:
- Name
- ID
- Entity Status
