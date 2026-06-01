---
name: alli-unified-data-get-models
description: Fetches all semantic models for a given client from the Unified Data API (UDA) v2.1. The models will be sorted so that the default cross-channel source (`isAlliDefaultSource=true`) and certified sources (`isCertified=true`) appear first.
---

# alli-unified-data-get-models

This skill securely fetches the list of available models for a client in the Alli Platform via the Unified Data API v2.1. It highlights the best datasource to use by bringing the default source and certified sources to the top.

### Prerequisites

Ensure you have run the following once before usage to authenticate:
```
@[/pmg-cowork-login]alli
```

### Command to Execute

```bash
python3 .agents/skills/alli-unified-data-get-models/scripts/get_models.py --client-id <CLIENT_ID>
```

### Arguments
- `--client-id`: (Required) The ID of the client to fetch models for. You can find this using the `alli-list-clients` skill.
- `--default-only`: (Optional) If provided, only returns the model marked as the default source for the client.


### Modification of this skill
If you are modifying this skill, you can reference the API documentation at https://dataexplorer.alliplatform.com/api-docs/#/Unified%20Data/unified-data_getModelMetadata
