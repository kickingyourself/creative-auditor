---
name: alli-4u-setup
description: Copies the alli-4u-install, alli-4u-update, and pmg-cowork-login skills into the current workspace's .agents/skills directory.
---

# `alli-4u-setup` Skill

This skill allows you to quickly bootstrap any new Antigravity automation workspace by copying the three essential baseline skills (`alli-4u-install`, `alli-4u-update`, and `pmg-cowork-login`) from the main `alli-4u-skills` repository straight into your current workspace's `.agents/skills` directory so they are available locally.

### Command to Execute

*Note: If you are using Claude Code, include the `--claude` parameter so the skills are copied to `.claude/skills` instead of `.agents/skills`.*

```bash
python3 .agents/skills/alli-4u-setup/scripts/bootstrap.py [--claude]
```
