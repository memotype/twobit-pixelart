# Pixel Forge (working title)

Offline pixel-art editor that exports efficient SVG and pixel-perfect PNG.

## Quick start

```sh
npm ci
npm run doctor
npm run lint
npm run typecheck
npm run md:lint
```

## Project rules (summary)

- `APP.md` is the definition of done. Follow it exactly.
- YAML is the only on-disk project format (no JSON persistence).
- `App.tsx` must remain composition-only.
- npm is the only supported package manager.
- ASCII-only repo rules apply.

## Current status

- Editor performance is smooth in production APK builds after recent
  optimizations.
- Debug stroke tracing is still enabled in the editor.

## Next task

- Redesign the editor menu:
  - Replace the right-side vertical rail with a hamburger in the upper-right.
  - Menu expands horizontally (not vertically) when tapped.
  - Hamburger rotates 90 degrees when open.
  - Must open on tap only (not triggered by drag-over while drawing).
