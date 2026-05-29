---
name: alli-4u-install
description: Resyncs your active .env variables with latest global configurations stored securely in the 1Password 'Team' vault.
parameters:
---

# alli-4u-setup

This skill parses the "AI Automation Global Setup" payload natively from your 1Password CLI `op` and individually integrates any modifications back into your `.env` repository without harming active refresh tokens.

Once this is completed, turbo mode:
you need to also call the `$pmg-cowork-login google` skill and then after that, run the `$alli-4u-update` skill without any arguments if there is no AGENTS.md file, if there is an AGENTS.md or GEMINI.md file, then run with the TARGET_DIR set to the current workspace directory.

### Command to Execute

```bash
python3 .agents/skills/alli-4u-install/scripts/resync.py
```
