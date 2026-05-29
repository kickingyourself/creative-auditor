---
name: alli-4u-create-skill
description: Guides users interactively through building a new custom skill, generating the SKILL.md and starter Python script pre-wired with the right auth boilerplate.
parameters: {}
---

# alli-4u-create-skill

This skill turns you (the AI agent) into an interactive wizard that helps the user build a new skill from scratch. Follow every step below in order. Do not skip steps or ask all questions at once.

---

## Step 1 — Discover Available Services

Before asking the user anything, run this command to enumerate existing skills:

```bash
ls .agents/skills/
```

From the output, extract the unique **service prefixes** by identifying the vendor name at the start of each directory (the part before the first action verb such as `list`, `read`, `send`, `get`, `download`, `archive`, `set`, `login`, `install`, `setup`, `update`). Group directories by vendor. For example:
- `alli-list-clients`, `alli-unified-data-preview` → service **Alli Platform**
- `google-read-calendar`, `google-read-gmail` → service **Google**
- `slack-read-channel`, `slack-send-slack-message` → service **Slack**
- `facebook-list-ad-accounts` → service **Facebook / Meta**
- `snapchat-list-ad-accounts` → service **Snapchat**
- `cm360-list-accounts` → service **CM360**
- `dv360-list-accounts` → service **DV360**
- `pmg-cowork-login`, `pmg-list-automation-accounts` → service **PMG Internal**

For each discovered service, read one of its `SKILL.md` files to note which env vars are required (look in the Prerequisites section or description). Store this as a reference list.

Always include **Custom / New Service** at the end of the list regardless of what was found.

---

## Step 2 — Collect Skill Intent via AskUserQuestion

Ask the user the following questions **one at a time**, waiting for each answer before moving to the next.

**Q1 — Name and description**
- What should the skill be named? (kebab-case, e.g. `alli-list-campaigns`, `google-export-sheet`)
- In one sentence, what should the skill do?

**Q2 — Target service**
- Which service should the skill connect to?
- Present the **dynamically built list** from Step 1 as the options.

**Q3 — Action and output**
- What specific action should the script take? (e.g. "call the campaigns endpoint and list all active campaigns")
- What should the output look like? (markdown table / plain text / file download / JSON)

**Q4 — Parameters** (repeat until the user says no more parameters are needed)
- What is the parameter name? (will become a `--kebab-case` CLI arg)
- What type is it? (string / integer / boolean)
- Is it required or optional?
- If optional, is there a default value?

---

## Step 3 — Confirm Before Creating

Show the user a summary of what will be generated:

```
Skill name:    {name}
Service:       {service}
Description:   {description}
Parameters:    {comma-separated list, or "none"}
Output:        {output format}

Will create:
  .agents/skills/{name}/SKILL.md
  .agents/skills/{name}/scripts/{action_verb}.py
  .claude/commands/{name}.md
```

Ask the user to confirm before proceeding to Step 4.

---

## Step 4 — Generate Files

### 4a. Create the skill's SKILL.md

Write `.agents/skills/{name}/SKILL.md` using this structure:

```
---
name: {name}
description: {description}
parameters:
  {param_name}:
    type: {type}
    description: {what the user described}
    required: {true|false}
  ... (one entry per parameter, omit section entirely if no parameters)
---

# {name}

{description}

### Prerequisites

{List the env vars required by the chosen service — use the reference list built in Step 1.}

### Command to Execute

\`\`\`bash
python3 .agents/skills/{name}/scripts/{action_verb}.py{param_flags}
\`\`\`
```

Where `{param_flags}` is the argparse-style flag string for each required parameter, e.g. `--campaign-id "{campaign_id}"`.

### 4b. Create the Python script

Select the correct template based on the chosen service:

| Service | Template to copy |
|---|---|
| Alli Platform | `.agents/skills/alli-4u-create-skill/scripts/templates/alli_template.py` |
| Google (any) | `.agents/skills/alli-4u-create-skill/scripts/templates/google_template.py` |
| Slack | `.agents/skills/alli-4u-create-skill/scripts/templates/slack_template.py` |
| All others / Custom | `.agents/skills/alli-4u-create-skill/scripts/templates/generic_template.py` |

Read the chosen template, then write a customized version to `.agents/skills/{name}/scripts/{action_verb}.py`, making these changes:
- Add an `argparse` argument for every parameter the user defined
- Replace the `# TODO: make your API call here` placeholder with the API call the user described (endpoint URL, HTTP method, query params or body)
- Update the markdown table `print` statements to reflect the actual columns in the expected response
- Update the env var names to match the correct ones for the chosen service (from the reference list in Step 1)

### 4c. Create the Claude Code slash command

Write `.claude/commands/{name}.md` so the skill is immediately available as a `/slash-command` in Claude Code:

- If the skill has no parameters: `Read \`.agents/skills/{name}/SKILL.md\` and execute it.`
- If the skill has parameters: `Read \`.agents/skills/{name}/SKILL.md\` and execute it. $ARGUMENTS\n\nIf no arguments were provided, ask the user for the required details.`

---

## Step 5 — Wrap Up

Print:

```
Skill created at: .agents/skills/{name}/

To use it:
  Claude Code:  /{name}
  Other agents: @[/{name}]
  Workflows:    reference in .agents/workflows/
```

---

## Service Reference

Use this table when writing env var requirements into the generated SKILL.md and when customising templates. These are the env vars required by each service already in this repo:

| Service | Required Env Vars | Auth Pattern |
|---|---|---|
| Alli Platform | `ALLI_CLIENT_ID`, `ALLI_REFRESH_TOKEN` | Refresh token → access token (rotating) via `https://login.alliplatform.com/token` |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | OAuth2 Credentials object via `google.oauth2.credentials.Credentials` |
| Slack | `SLACK_CLIENT_ID`, `SLACK_REFRESH_TOKEN` (optional: `SLACK_CLIENT_SECRET`) | Refresh token → access token via `https://slack.com/api/oauth.v2.access` |
| Facebook / Meta | `FB_ACCESS_TOKEN` | Static bearer token |
| Snapchat | `SNAPCHAT_CLIENT_ID`, `SNAPCHAT_REFRESH_TOKEN` | Refresh token → access token on every call |
| CM360 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Same Google OAuth as above |
| DV360 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Same Google OAuth as above |
| PMG Internal | Uses 1Password CLI (`op`) — no env vars needed | `subprocess` call to `op read` |
