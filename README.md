# App Template

Baseline template for TypeScript tooling in React/Expo projects. This
repository is a reusable baseline for future TypeScript and React Native
/ Expo apps, with a minimal Expo SDK 54 scaffold included.

## Requirements

- Node.js 20.19.4 (see `.nvmrc`)
- npm 11.7.0 (required; other package managers are blocked)

This repo enforces the Node.js engine version via `.npmrc` and npm will
error if the active Node.js version does not match `package.json`.
The required npm version is declared in `package.json` and enforced by
`scripts/ensure-npm.cjs`.

If you use NVM for Windows, run `nvm use` in the repo root to match
`.nvmrc`.

## Quick start

```sh
npm ci
npm run doctor
npm run lint
npm run typecheck
npm run md:lint
```

## GitHub Pages (public repo deploy)

To keep app repos private but publish a static site, use a separate public
repo for Pages and push only built output from this repo.

1. Create a public repo for the site (example: `yourname/app-site`).
2. In that repo, enable Pages with source `gh-pages` / root.
3. Create a fine-grained PAT with access to the public repo and:
   - `Contents: Read/Write`
4. Add the PAT in this repo as a secret named `PAGES_PUBLISH_TOKEN`.
5. Update `.github/workflows/publish-pages.yml`:
   - Set `external_repository` to your public repo.
   - Set `publish_dir` to your build output (for example `./dist`).

The workflow is safe to keep in the template; it skips if the secret is
missing. Customize the build command to match your static site tooling.

For a no-Actions path, use the PowerShell script to push `./static` into a
public Pages repo:

```powershell
./scripts/publish-pages.ps1 -AppName "My App"
```

Set `-Remote` or `-Branch` if your Pages repo or branch differs.

## Manual steps (NOT for Codex)

A Codex prompt is provided below this section.

1. Create an empty project directory.
2. From this template repo, seed the target directory without git history
   and set the package name. The target directory must be empty.

   ```powershell
   ./scripts/init-project.ps1 -TargetPath "C:\\path\\to\\my-app" `
     -Name "my-app" -Branch main -RemoteUrl git@github.com:org/repo.git
   ```

3. Review `package.json` name, then commit.
4. Install dependencies:
   - `npm install` (updates `package-lock.json` after rename)
   - `npm ci` (use for clean installs after lockfile update)
5. Verify Expo setup:
   - `npm run doctor`

The init script avoids VS Code locking `.git` because it clones into a temp
directory and copies everything except `.git` into the target directory.

The init script updates `package.json` and `app.json` only. Do not edit
`README.md` in the new repo until `APP.md` is replaced. Prefer the init script
for new repos; manual setup is supported but secondary.

If you prefer a manual setup, remove `.git`, run `git init`, add your
remote, and commit.

## New project setup - Codex prompt

New projects should be initialized by Codex using this prompt (copy the markdown
below literally and include all backticks and quotes)

````markdown
We are setting up a new development environment based on a template.

NEW_APP_NAME=hello-world
NEW_APP_DIR=<CWD>
REMOTE_URL=git@github.com:memotype/<NEW_APP_NAME>.git

1. Ensure `<NEW_APP_DIR>` exists and is empty.
2. Clone `git@github.com:memotype/twobit-app-template.git` to a temporary
   folder.
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
6. Do not edit `README.md` in the new repo (APP.md restriction). Report
   results and update `<NEW_APP_DIR>/ISSUES.md` for any failures, then stop.
````

## Package manager policy

- npm is the only supported package manager.
- The preinstall guard rejects yarn, pnpm, bun, and others.
- `package-lock.json` is required and must stay in sync.
- All npm scripts enforce npm-only execution.
- `npx` is allowed only for packages already listed in `package.json`.

## What is included

- Expo SDK 54 scaffold with `App.tsx` and `app.json`
- ESLint (flat config) + TypeScript linting
- Prettier formatting
- Markdown linting
- Minimal TypeScript config
- VS Code settings and extension recommendations

## What is not included

- No native project folders (`ios/`, `android/`) or EAS config.

## Scripts

- `npm run start`: Start the Expo dev server
- `npm run start:clear`: Start the Expo dev server with cache clear
- `npm run start:tunnel`: Start the Expo dev server with tunnel
- `npm run doctor`: Run Expo doctor checks
- `npm run lint`: Lint with ESLint
- `npm run format`: Check formatting with Prettier
- `npm run format:write`: Format files with Prettier
- `npm run typecheck`: Type check with TypeScript
- `npm run typecheck:script`: Type check with the TypeScript script
- `npm run md:lint`: Lint Markdown with markdownlint
- `npm run md:lint:cli2`: Lint Markdown with markdownlint-cli2

## Manual setup (no history)

To create a new app repo without linking history:

1. Clone this repo locally
2. Delete the `.git` directory
3. Re-initialize Git
4. Push to a new, empty GitHub repo

This ensures each app has independent history and ownership.

```sh
mkdir <MYNEWAPP>
cd <MYNEWAPP>
git clone --depth 1 git@github.com:memotype/twobit-app-template.git `
  temp-template
Get-ChildItem -Force temp-template | Where-Object { $_.Name -ne '.git' } |
  ForEach-Object { Copy-Item -Recurse -Force $_.FullName . }
Remove-Item -Recurse -Force temp-template
git init
git branch -M main
git add .
git commit -m "Initial commit from template"
git remote add origin git@github.com:memotype/<MYNEWAPP>.git
git push -u origin main
```
