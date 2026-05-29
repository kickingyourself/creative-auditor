---
name: slack-read-channel
description: Reads messages from a designated Slack channel.
parameters:
  channel:
    type: string
    description: The Slack channel ID or channel name to read messages from (e.g. C12345678 or #general).
    required: true
  days_back:
    type: integer
    description: The number of days back to read messages.
    required: false
    default: 2
---

# read_slack_channel

This skill uses the `SLACK_REFRESH_TOKEN` to retrieve a fresh user access token and reads messages from a specified Slack channel, restricted to the number of days back specified.

### Command to Execute

```bash
python3 .agents/skills/slack-read-channel/scripts/read.py --channel "{channel}" --days_back {days_back}
```
