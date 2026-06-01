---
name: alli-gendash-list
description: Lists generative dashboards for a client or specific user from the Alli Platform.
---

# alli-gendash-list

This skill fetches a list of Generative Dashboards for a specific client. If a user ID is provided, it fetches the dashboards specific to that user.

### Prerequisites

Ensure you have run the following once before usage to authenticate:
```
@[/pmg-cowork-login]alli
```

### Command to Execute

```bash
python3 .agents/skills/alli-gendash-list/scripts/list_dashboards.py --client-id <CLIENT_ID> [--user-id <USER_ID>]
```

### Arguments
- `--client-id`: (Required) The ID of the client to fetch dashboards for.
- `--user-id`: (Optional) The ID of the user to specifically fetch dashboards for.

### Modification of this skill
If you are modifying this skill, you can reference the API documentation at https://generativedashboards.alliplatform.com/api-docs/#/
