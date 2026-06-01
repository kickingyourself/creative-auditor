---
name: cm360-list-accounts
description: This skill allows you to list User Profiles, Accounts, and Advertisers in Campaign Manager 360 (CM360).
---

# CM360 Partners and Advertisers

This skill allows you to list User Profiles, Accounts, and Advertisers in Campaign Manager 360 (CM360).

## Prerequisites

- Service Account key file path must be set in `GOOGLE_APPLICATION_CREDENTIALS` in the `.env` file.
- The service account email must be added to CM360 with appropriate permissions (User Profile).

## Usage

### 1. List User Profiles
First, list the User Profiles to find the `Profile ID` you need to use for other commands.

```bash
python3 .agents/skills/cm360-list-accounts/scripts/list_accounts.py
```

### 2. List Advertisers
List advertisers associated with a specific Profile ID.

```bash
python3 .agents/skills/cm360-list-accounts/scripts/list_accounts.py --profile-id <PROFILE_ID>
```

### 3. List Accounts
List accounts associated with a specific Profile ID.

```bash
python3 .agents/skills/cm360-list-accounts/scripts/list_accounts.py --profile-id <PROFILE_ID> --list-accounts
```

### 4. Create a Campaign
Create a new CM360 campaign. Note: Campaigns are created as **ACTIVE** (`archived=False`) by default.

```bash
python3 .agents/skills/cm360-list-accounts/scripts/create_campaign.py \
  --profile-id <PROFILE_ID> \
  --advertiser-id <ADVERTISER_ID> \
  --name "My New Campaign" \
  --url "https://example.com" \
  --start-date "2026-05-01" \
  --end-date "2026-12-31"
```

## Output

The skill will output lists in a formatted table, including:
- **User Profiles**: Profile ID, User Name, Account Name.
- **Advertisers**: Advertiser ID, Name, Status.
- **Accounts**: Account ID, Name.
