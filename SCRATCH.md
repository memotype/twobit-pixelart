# SCRATCH.md

Current state notes for handoff.

## Assumptions and invariants

- App is in App mode with project-specific APP.md already in place.
- YAML is the only on-disk project format; no JSON persistence.
- Autosave writes only `<id>.pfx.working.yaml` via `.tmp` + move.
- Explicit Save uses atomic replace: `.tmp` -> `.bak` -> canonical.
- `*.working.yaml` is the only restore artifact; `*.tmp` are deleted on
  open/list; backups are not used for restore prompts.
- Hardware back button in Editor follows SAVE / DISCARD / CANCEL semantics.
- Pixel buffer uses Uint32Array palette indices (RGBA8888 palette).
- Expo SDK 54 baseline with npm-only tooling.

## Recent persistence changes (locations)

- `src/lib/storage/projectStorage.ts`:
  - `saveWorkingCopy`, `saveProjectExplicit`, `cleanupTmpFiles`,
    `loadWorkingCopy`, `workingCopyExists`, `deleteWorkingCopy`.
- `src/features/gallery/GalleryScreen.tsx`:
  - `openProjectWithRecoveryPrompt` prompts Restore/Discard on open.
- `src/features/editor/EditorScreen.tsx`:
  - Autosave uses working copy only; explicit save path used on exit.
- `src/lib/export/svgExport.ts`:
  - `exportSvgFile` writes SVG to cache for sharing.

## Tooling status

- Tests last run: 2026-01-23
  - `npm run doctor`, `npm run lint`, `npm run typecheck`, `npm run md:lint`.
