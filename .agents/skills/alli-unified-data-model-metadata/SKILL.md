---
name: alli-unified-data-model-metadata
description: Retrieves metadata for a specific semantic model via the Unified Data API (UDA) v2. It fetches and lists the available dimensions and measures.
---

# alli-unified-data-model-metadata

This skill fetches the metadata for a given semantic model, which includes a detailed list of all its available dimensions and measures. This is very helpful when you need to know which fields to include in your preview or download queries.

### Prerequisites

Ensure you have run the following once before usage to authenticate:
```
@[/pmg-cowork-login]alli
```

### Command to Execute

```bash
python3 .agents/skills/alli-unified-data-model-metadata/scripts/metadata.py --client-id <CLIENT_ID> --model <MODEL_NAME>
```

### Arguments
- `--client-id`: (Required) The ID of the client.
- `--model`: (Optional) The name of the semantic model (e.g., `unified`). If omitted, the skill will fetch the models list and use the `isAlliDefaultSource`.


### Modification of this skill
If you are modifying this skill, you can reference the API documentation at https://dataexplorer.alliplatform.com/api-docs/#/Unified%20Data/unified-data_getModelMetadata
