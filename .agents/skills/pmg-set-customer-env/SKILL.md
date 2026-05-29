---
name: pmg-set-customer-env
description: Replaces the local .env file with the environment variables stored in the 'notesPlain' field of a 1Password item for a specific AI Automation client.
---

# set_customer_env

This skill retrieves the environment variables (stored as plain text in the `notesPlain` field) from a 1Password item, and replaces the contents of the local `.env` file with these values. It searches across all accessible vaults.

It also updates a `.current_customer` hidden file so the AI agent knows which account is actively targeted.

## Usage

You must pass the name of the client to the python script.

### Command to Execute
```bash
python3 .agents/skills/pmg-set-customer-env/scripts/set_env.py "Dutch Bros"
```
*(You can pass either the exact item name like "AI Automation - Dutch Bros" or just the client name like "Dutch Bros")*

### Purpose
Use this skill whenever the user asks to switch contexts or select an account for automation tasks. Never switch accounts without the user's explicit request.

## Prerequisites
- The user must have the 1Password CLI (`op`) installed and authenticated.
