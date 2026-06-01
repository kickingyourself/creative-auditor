---
name: pmg-list-automation-accounts
description: Lists all available AI Automation customer accounts from all accessible 1Password vaults.
---

# list_automation_accounts

This skill retrieves a list of all configured AI Automation accounts from 1Password. It connects across all your accessible vaults and filters for items prefixed with "AI Automation - ".

## Usage

You can use the provided python script to fetch and display the available automation accounts. The script runs the `op` CLI and parses the JSON output.

### Command to Execute
```bash
python3 .agents/skills/pmg-list-automation-accounts/scripts/list_accounts.py
```

### Purpose
Use this skill when you need to know which customer accounts are available or when you need to prompt the user to select an account for an automation task.

## Prerequisites
- The user must have the 1Password CLI (`op`) installed and accessible.
- Python 3 must be available in the environment.
