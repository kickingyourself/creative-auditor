---
name: google-read-google-sheet
description: Reads data from a Google Sheet using the active Google credentials configured in the environment.
---

# read_google_sheet

This skill connects to Google Sheets using the Google OAuth refresh token credentials loaded via the `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN` environment variables.

You can use this skill to extract data from a Google Sheet by providing a Spreadsheet URL or ID.

## Usage

Run the python script and provide the Spreadsheet URL or ID as an argument. Optionally, provide a range (e.g., `'Sheet1!A1:D10'`). If no range is provided, it attempts to fetch all data from the first visible sheet.

### Command to Execute
```bash
# Read entire first sheet
python3 .agents/skills/google-read-google-sheet/scripts/read_sheet.py "https://docs.google.com/spreadsheets/d/1C8PPgeVx1pO0GzzotBi2m0eMaTbCslWE_RdmeJ_24Wc/edit"

# Read specific range using ID
python3 .agents/skills/google-read-google-sheet/scripts/read_sheet.py "1C8PPgeVx1pO0GzzotBi2m0eMaTbCslWE_RdmeJ_24Wc" "Campaigns!A1:Z100"
```

## Prerequisites
- The active `.env` file must contain valid `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN` variables.
- The Google Account associated with the `GOOGLE_REFRESH_TOKEN` must have "Viewer" or "Editor" permissions on the target Google Sheet.
- Python dependencies `google-api-python-client`, `google-auth-httplib2`, and `google-auth-oauthlib` must be installed.
