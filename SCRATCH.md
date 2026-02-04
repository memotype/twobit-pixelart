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
- `src/features/editor/EditorScreenV2.tsx`:
  - Autosave uses working copy only; explicit save path used on exit.
- `src/lib/export/svgExport.ts`:
  - `exportSvgFile` writes SVG to cache for sharing.

## Recent editor/render work (performance-focused)

- Removed legacy editor file; app now uses `EditorScreenV2` only.
- Canvas renderer migrated from SVG nodes to Skia.
- Added per-frame dirty pixel batching in editor state updates.
- Added line interpolation to reduce skipped pixels during fast moves.
- Moved input capture to `react-native-gesture-handler` pan gesture with
  worklet handlers and `runOnJS` batching.
- Canvas now uses a persistent Skia surface with dirty pixel draws.
- Stroke bridge payload was reduced:
  - `CanvasView` now sends stroke segment endpoints only
    (`fromIndex` -> `toIndex`) from worklet to JS.
  - `EditorScreenV2` now interpolates each segment in JS with Bresenham
    stepping to preserve full pixel fidelity while reducing `runOnJS` payload.
- Remaining major bottlenecks are tracked in `ISSUES.md`.

## Tooling status

- Most recent checks run in this session:
  - `npm run lint`
  - `npm run typecheck`

## Notes

- Explicit save crash window (between canonical->bak and tmp->canonical moves)
  is expected to be milliseconds (typically < 100 ms) and is acceptable.
- Export pipeline status:
  - SVG export is string-built in `src/lib/export/svgExport.ts`.
  - PNG export is custom-encoded in `src/lib/export/pngExport.ts`.
  - `react-native-svg` was removed and is not used for export.

## Outstanding issues

- See `ISSUES.md`.
