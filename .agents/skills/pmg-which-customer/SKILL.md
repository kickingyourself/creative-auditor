---
name: pmg-which-customer
description: An obligatory skill that reads and outputs the current customer context.
---

# which_customer

This skill reads the `.current_customer` file in the root directory and outputs the currently selected AI Automation account. As per `AGENTS.md`, you MUST run this script at the beginning of any task.

### Command to Execute
```bash
python3 .agents/skills/pmg-which-customer/scripts/check.py
```
