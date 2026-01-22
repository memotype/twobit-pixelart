# SCRATCH.md

This file is intentionally minimal at template reset.
Codex: record assumptions, decisions, and TODOs here during regeneration.

## Assumptions

- Use npm 11.7.0 from local environment for packageManager.
- Use ESLint 9 + flat config with typescript-eslint and @eslint/js.
- Use Prettier 3 and markdownlint-cli2 for formatting/linting.
- Force ASCII output in init-project.ps1 to avoid PowerShell UTF-16.
- Windows PowerShell is acceptable for bootstrap scripts.
- Include a minimal Expo SDK 54 scaffold to satisfy dev contract.

## Plan

1. Inspect repo state and existing files to avoid conflicts.
2. Draft required baseline config files per APP.md.
3. Create npm package.json + lockfile and wire scripts.
4. Add scripts/init-project.ps1 and repo docs.
5. Run a consistency check of scripts/config paths.

## Decisions

- Configure markdownlint MD013 to ignore code blocks and tables.
- Enforce 80-column code lines via ESLint `max-len` for JS/TS.

## Notes

- APP.md is still the template copy and needs a project-specific replacement.
