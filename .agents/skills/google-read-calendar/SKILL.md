---
name: google-read-calendar
description: Reads Google Calendar events within a specified date range and outputs a unified markdown table log.
---

# `read_google_calendar` Skill

This skill reads events from a Google Calendar between `start-date` and `end-date`. Date parameters default to the current week (from Monday to Sunday) if omitted.

It uses the `GOOGLE_REFRESH_TOKEN` to access the target Calendar, along with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## Prerequisites

- Project `.env` must contain valid Google OAuth variables:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REFRESH_TOKEN`
- The `google-api-python-client`, `google-auth-httplib2`, and `google-auth-oauthlib` packages must be installed.
- The `login` skill must have been run to ensure Google Calendar scope (`https://www.googleapis.com/auth/calendar`) is granted.

## Scripts & Usage

### 1. `read_calendar.py`

This script handles the Google Calendar API authentication and fetches the events.

**Basic Usage (Defaults to current week):**

```bash
python3 .agents/skills/google-read-calendar/scripts/read_calendar.py
```

**Parameters:**

- `--start-date`: Optional. The start date in `YYYY-MM-DD` format.
- `--end-date`: Optional. The end date in `YYYY-MM-DD` format. 
- `--calendar-id`: Optional. Calendar ID to read (defaults to `primary`). 

**Query Example:**

```bash
python3 .agents/skills/google-read-calendar/scripts/read_calendar.py --start-date 2026-04-01 --end-date 2026-04-08
```

## Output Format

The output is formatted as a Markdown table.

| Event ID | Start | End | Summary | Location |
|---|---|---|---|---|
| event_id_123 | 2026-04-08T10:00:00Z | 2026-04-08T11:00:00Z | Team Meeting | Conference Room A |
| event_id_456 | 2026-04-09 | 2026-04-10 | Holiday |  |
