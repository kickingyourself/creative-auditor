---
name: google-archive-gmail
description: Archives Gmail messages by removing the INBOX label. Accepts an array of message IDs.
parameters:
  message_ids:
    type: array
    items:
      type: string
    description: A list of Gmail Message IDs to archive.
    required: true
---

# archive_gmail

This skill connects to Gmail using the configured Google OAuth credentials.
It archives the specified messages by essentially removing their `INBOX` label via a batch modify request.

## Usage

Provide one or more Gmail Message IDs separated by spaces to the script execution.

### Command to Execute
```bash
python3 .agents/skills/google-archive-gmail/scripts/archive_gmail.py MESSAGE_ID_1 MESSAGE_ID_2
```

## Prerequisites
- The `.env` file must contain `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`.
- The Google OAuth token must include the `https://mail.google.com/` scope.
