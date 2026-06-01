---
name: slack-send-slack-message
description: Sends a message to a designated Slack channel as the authorized user.
parameters:
  channel:
    type: string
    description: The Slack channel ID or channel name to send the message to (e.g. C12345678 or #general).
    required: true
  message:
    type: string
    description: The text content of the message to send.
    required: true
---

# send_slack_message

This skill uses the `SLACK_REFRESH_TOKEN` to retrieve a fresh user access token and posts a message to a specified Slack channel. The message will appear as if it was sent by the user who authorized the app. Make sure `SLACK_REFRESH_TOKEN` and `SLACK_CLIENT_ID` are present in your `.env` file via the `login` skill.

### Command to Execute

```bash
python3 .agents/skills/slack-send-slack-message/scripts/send.py --channel "{channel}" --message "{message}"
```
