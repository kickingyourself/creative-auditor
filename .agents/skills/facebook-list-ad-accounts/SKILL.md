---
name: facebook-list-ad-accounts
description: Fetches and lists all accessible Facebook Ad Accounts associated with the currently loaded FB_ACCESS_TOKEN.
---

# list_facebook_ad_accounts

This skill calls the Facebook Graph API to retrieve a list of all Ad Accounts accessible using the `FB_ACCESS_TOKEN` stored in the current environment or `.env` file.

## Usage

Run the following python script which will output the list of Ad Accounts along with their IDs:

### Command to Execute
```bash
python3 .agents/skills/facebook-list-ad-accounts/scripts/list_accounts.py
```

### Purpose
Use this skill when you need to know which Facebook Ad Accounts are available to execute campaigns or when you need an Ad Account ID for other Facebook Graph API operations.

## Prerequisites
- Working `FB_ACCESS_TOKEN` loaded in your `.env` file.
- Python 3 with the `requests` and `python-dotenv` packages (or the script should handle loading `.env` naturally).
