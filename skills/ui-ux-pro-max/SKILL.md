---
name: ui-ux-pro-max
description: Query this project's local design data for palettes, typography, components, UX rules, charts or stack guidance.
---

# Design data search

The maintained source is `skills/ui-ux-pro-max/`. Claude and Codex link to this directory and use the same Python scripts and CSV data.

Use the search tool when the task needs design data. Preserve the product's existing design decisions unless the user requests a new direction. A small UI fix does not require generating a design system or following a full redesign workflow.

From the repository root:

```bash
python3 skills/ui-ux-pro-max/scripts/search.py --help
python3 skills/ui-ux-pro-max/scripts/search.py "<query>" --domain color -n 3
```

Choose only the relevant domain or stack. Before generating or persisting a design system, read the matching command section of [the search guide](references/search-guide.md). Its complete workflows and examples are for those requests, not mandatory prerequisites for every UI change.

The guide's `.claude/skills/ui-ux-pro-max/` command paths remain valid through the compatibility link. Scripts and data stay together; do not copy or synchronize a second skill tree per harness.
