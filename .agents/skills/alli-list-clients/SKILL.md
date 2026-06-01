---
name: alli-list-clients
description: Fetches and lists all active clients and their slugs from Alli Central API. Requires ALLI_REFRESH_TOKEN to be populated via the pmg-cowork-login skill.
parameters: {}
---

# alli-list-clients

This skill securely fetches the list of available clients that the current user context has access to within the Alli Platform. It uses the `ALLI_CLIENT_ID` and `ALLI_REFRESH_TOKEN` to mint a short-lived `access_token` and queries the Central API directly.

### Prerequisites

Ensure you have run the following once before usage:
```
@[/pmg-cowork-login]alli
```

### Command to Execute

```bash
python3 .agents/skills/alli-list-clients/scripts/list_clients.py
```
