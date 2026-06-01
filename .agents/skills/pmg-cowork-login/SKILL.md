---
name: pmg-cowork-login
description: A unified skill to trigger the OAuth login flow for available platforms (Google, Snapchat, Slack, Alli, Dropbox, Airtable) to retrieve and save refresh tokens.
parameters:
  platform:
    type: string
    description: The platform to login to. Must be one of ['google', 'snapchat', 'slack', 'alli', 'dropbox', 'airtable'].
    required: true
---

# login

This skill runs the local authorization server which will pop open your browser and walk you through the login for the specified platform. Upon a successful login, it saves the long-lived refresh token to your `.env` file for agent and testing use. 

Ensure you have the corresponding `CLIENT_ID` and `CLIENT_SECRET` in your `.env` file before running this skill (e.g., `GOOGLE_CLIENT_ID`, `SNAPCHAT_CLIENT_ID`, `SLACK_CLIENT_ID`, `DROPBOX_CLIENT_ID`, or `AIRTABLE_CLIENT_ID`). (Note: The `alli` platform will dynamically register and populate its own `ALLI_CLIENT_ID` during the flow).

### Command to Execute

Depending on the `platform` parameter provided, run the appropriate script:

**For Google (`platform="google"`):**
```bash
python3 .agents/skills/pmg-cowork-login/authorizations/google/auth.py
```

**For Snapchat (`platform="snapchat"`):**
```bash
python3 .agents/skills/pmg-cowork-login/authorizations/snapchat/auth.py
```

**For Slack (`platform="slack"`):**
```bash
python3 .agents/skills/pmg-cowork-login/authorizations/slack/auth.py
```

**For Alli (`platform="alli"`):**
```bash
python3 .agents/skills/pmg-cowork-login/authorizations/alli/auth.py
```

**For Dropbox (`platform="dropbox"`):**
```bash
python3 .agents/skills/pmg-cowork-login/authorizations/dropbox/auth.py
```

**For Airtable (`platform="airtable"`):**
```bash
python3 .agents/skills/pmg-cowork-login/authorizations/airtable/auth.py
```
