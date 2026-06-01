---
name: alli-4u-update
description: Downloads the latest automation repository from Google Drive, calculates file additions and replacements, prompts the user for confirmation, and applies the changes locally.
---

# `upgrade_automations` Skill

This skill synchronizes the current workspace by pulling down `ai-impact-automations.zip` from Google Drive (Folder `1YfS8ix4pNa-rsEhj3mF4MiFWK21q3jdM`), unpacking it, reviewing changes against local files, prompting for your confirmation, and ultimately committing to overwriting files.

If you do not have an AGENTS.md file or do not have skills inside of .agents/skills or .claude/skills, you should NOT USE PATCH MODE. Keep the TARGET_DIR blank for new setups. 

## Behavior

- Compares the remote zipped contents to the local working directory.
- In **Install Mode** (no `TARGET_DIR` provided), updates are applied automatically.
- In **Patch Mode** (with `TARGET_DIR`), an interactive prompt (`y/n`) lists precisely what will be Add/Replaced before proceeding.
- Excluded paths include `.git/`, `.env`, and `google_credentials/` to protect system environment and tracking stability.

## Prerequisites

- Project `.env` must contain valid Google OAuth variables:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REFRESH_TOKEN`
- Requirements: `google-api-python-client`

## Usage

Run the Python script directly from your terminal. If you are in **Patch Mode**, you must answer the interactive prompt. 

In **Install Mode**, the script will proceed without user interaction to streamline the setup process.

### Command to Execute

*Note: If you are using Claude Code, include the `--claude` parameter so the updates are applied to `.claude/skills` and `.claude/workflows` instead of `.agents`.*

```bash
python3 .agents/skills/alli-4u-update/scripts/upgrade.py [TARGET_DIR] [--claude]
```
