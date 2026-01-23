# Codex prompts

---

## NEW CODEX SESSION

```markdown
Read `CODEX.md` and all referenced files, if available, including:
- `README.md`
- `REPO.md`
- `APP.md`
- `SCRATCH.md`
- `ISSUES.md`

Don't edit any file yet, just report whether or not you understand and summarize
your understanding of the instruction.
```

---

## NEW PROJECTS

````markdown
We are setting up a new development environment based on a template.

```pseudocode
NEW_APP_NAME=hello-world
NEW_APP_DIR=<CWD>
REMOTE_URL=git@github.com:memotype/<NEW_APP_NAME>.git
```

1. Ensure `<NEW_APP_DIR>` exists and is empty.
2. Clone `git@github.com:memotype/twobit-app-template.git` to a temp folder.
3. In the temp clone, read `CODEX.md`, `REPO.md`, `APP.md`, `README.md`.
4. From the temp clone, run:
   ```powershell
   ./scripts/init-project.ps1 -TargetPath "<NEW_APP_DIR>" `
     -Name "<NEW_APP_NAME>" `
     -Branch main `
     -RemoteUrl <REMOTE_URL>
   ```
5. In `<NEW_APP_DIR>`, run bootstrap steps:
   `npm ci`, `npm run doctor`, `npm run lint`, `npm run typecheck`,
   `npm run md:lint`.
6. Do not edit `README.md` in the new repo (`APP.md` restriction). Report
   results and update `<NEW_APP_DIR>/ISSUES.md` for any failures, then stop.
7. If `npm run doctor` fails due to an Expo SDK package mismatch, treat it as a
   template defect. Do NOT apply ad-hoc fixes in the new project. Report the
   exact mismatch and STOP after logging it in `ISSUES.md`.
````

---

## SYNC EXISTING PROJECTS

```markdown
We need to sync template-managed files from the app-template repo into this
project. Follow `CODEX.md` and `REPO.md` rules.

Target template: default to local `../app-template/`. The whitelist source is
the `scripts/sync-template.ps1` file from the chosen template ref. When using
local, use whatever is currently checked out there and do not ask for a ref.

- local: `../app-template/` (default; use whatever is currently checked out)
- remote: `git@github.com:memotype/twobit-app-template.git`

Rules:

- Only update files on the TEMPLATE SYNC WHITELIST.
- Do not modify `APP.md`, `README.md`, or any project-owned files.
- Overwriting `CODEX.md` and `REPO.md` is allowed only as part of template
  sync using the whitelist and sync script.
- Use the dedicated sync script at `scripts/sync-template.ps1` from the
  chosen template ref (it contains the authoritative whitelist).
- Commit with message: "Sync template `ref`"

Steps:

1. Read `CODEX.md`, `REPO.md`, `APP.md`. Stop and report conflicts.
2. If working tree is not clean, ask whether to commit or stash app changes.
   Do not discard anything without explicit instruction.
3. Ensure the local template exists:
   - If `../app-template` exists, use it as-is and do not ask for a ref.
   - If it does not exist, use remote `main` by default.
4. Run:
   - local: `powershell -File scripts/sync-template.ps1`
   - remote: `powershell -File scripts/sync-template.ps1 -TemplateRef main`
5. Review git status and git diff. Only whitelist files should change.
6. If any non-whitelist file changes, stop and report.
7. Commit with message: "Sync template ref" (use the actual ref if known,
   otherwise use "Sync template (local)").
8. Push to main.

Optional deps alignment:

- Run: `powershell -File scripts/sync-deps.ps1` (if local), or
  `powershell -File scripts/sync-deps.ps1 -TemplateRef main` (if remote)
- Commit `package.json` + `package-lock.json` together with message
  "Sync deps ref" (or "Sync deps (local)").
```
