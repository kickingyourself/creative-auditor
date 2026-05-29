---
name: google-read-gmail
description: Reads Gmail messages with optional start and end date filters.
parameters:
  start_date:
    type: string
    description: Optional start date in YYYY/MM/DD format.
    required: false
  end_date:
    type: string
    description: Optional end date in YYYY/MM/DD format.
    required: false
  max_results:
    type: integer
    description: Optional maximum number of messages to retrieve (defaults to 10).
    required: false
  query:
    type: string
    description: Optional raw Gmail search query.
    required: false
  all_mail:
    type: boolean
    description: Search all mail instead of just the INBOX.
    required: false
---

# read_gmail

This skill connects to Gmail using the configured Google OAuth credentials.
It retrieves a list of messages from the authenticated user's inbox based on optional date filters.

## Usage

By default, the script looks only in your INBOX. Use the command-line arguments to limit the date ranges, pass custom queries, or fetch from all mail.

### Command to Execute
```bash
python3 .agents/skills/google-read-gmail/scripts/read_gmail.py --start-date 2024/01/01 --end-date 2024/12/31 --max-results 5
```

You can also pass a custom query (e.g., `is:unread`) or search all your archived mail:
```bash
python3 .agents/skills/google-read-gmail/scripts/read_gmail.py --query "is:unread" --all-mail --max-results 20
```

If no arguments are provided, it simply returns the 10 most recent messages from your INBOX over all time.

### Output Format
The skill outputs the retrieved messages in a Markdown table format to standard output. Example:

```markdown
| ID | Date | From | Subject | Snippet |
|---|---|---|---|---|
| 18ebd3... | Fri, 26 Jan 2024... | sender@example.com | Hello World | This is an email snippet... |
```

## Prerequisites
- The `.env` file must contain `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`.
- The Google OAuth token must include the `https://mail.google.com/` scope.
