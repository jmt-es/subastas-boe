<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Account Routing

- This repo is always personal-context: GitHub `jmt-es`, Vercel account `jmt-es`, Vercel scope `jmtes-projects`.
- Before any `gh`, `vercel`, deploy, env/logs, PR, or account-sensitive Git operation, run `/Users/javierhamelyn/bin/work-context summary` from this repo or its worktree.
- Do not infer account/scope from a global `gh auth status` or a global `vercel whoami`.
- Inside this repo and its worktrees, raw `gh` and raw `vercel` are context-aware shims. Outside them, force the profile with `/Users/javierhamelyn/bin/gh-personal` and `/Users/javierhamelyn/bin/vercel-personal`.

## Repo Notes

- For broader repo guidance, also read `/Users/javierhamelyn/Code/personal/subasta/CLAUDE.md`.
