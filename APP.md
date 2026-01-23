# APP.md

## Project mode

This repository is in **App mode** (derived from the template).
This file replaces the template APP.md.

If this file still contains template-only text (versioning domains, template
release rules, etc), STOP and replace it before feature work.

## App name (working)

Pixel Forge (working title)

## One-line pitch

An offline pixel-art editor that exports **efficient SVG** and **pixel-perfect
PNG**, with deterministic results and no tracking.

## Non-negotiables

- Offline-first. No network features.
- No accounts, no analytics, no ads.
- Deterministic exports (same input => same output bytes, modulo whitespace).
- Keep the UI small and utility-focused.
- ASCII-only repo rules apply.

## Storage format: YAML-first (canonical)

Project files MUST be stored as **YAML**.

- YAML is the canonical on-disk format.
- Runtime logic MUST operate on normalized JS/TS objects (in-memory).
- JSON MUST NOT be used as the persistence format for projects.
- Do not add any "temporary" JSON save/load path.

Allowed:
- YAML read/write from local app storage.
- Optional: also export/import YAML project files (shareable).

Not allowed:
- Project persistence as JSON files.
- Silent YAML<->JSON conversions stored to disk.

## MVP user stories

1. Create a new project (width/height, name).
2. Draw pixels (pencil + eraser).
3. Palette selection (at least a small default palette).
4. Undo / redo.
5. Autosave and reopen projects locally.
6. Export:
   - Optimized SVG (merged rectangles).
   - PNG (pixel-perfect, scaled).

## Screens (MVP)

Two screens only:

1) Gallery
   - List local projects (name, dims, updated).
   - New / Open / Delete (confirm).

2) Editor
   - Canvas view with pan/zoom as needed (keep simple).
   - Tools: Pencil, Eraser, Undo, Redo.
   - Palette picker.
   - Export: SVG + PNG (scale: 1x, 2x, 4x, 8x).
   - Autosave with visible status text.


## Persistence and back-button behavior (YAML-first, copy-on-write)

### Goals

- Never overwrite the user's canonical project file implicitly.
- Autosave MUST be copy-on-write:
  - write to a per-project temporary "working copy"
  - keep the canonical project file untouched until explicit Save
- Recovery:
  - on open, if a working copy exists, prompt the user to restore it
  - working copies allow crash/power-loss recovery

### File roles

- Canonical project file (authoritative, user-facing):
  - `<id>.pfx.yaml`
- Working copy (autosave target, crash recovery):
  - `<id>.pfx.working.yaml`
- Backup (optional, used only during explicit Save to reduce risk):
  - `<id>.pfx.bak.yaml`

### Naming requirements

- File naming MUST be stable and predictable for detection.
- Working copy name MUST be derived solely from the canonical project id.
- Canonical, working, backup, and staging (*.tmp) files for a project MUST live
  in the same directory to preserve move/rename semantics.

### Autosave rules

- Autosave writes only to the working copy.
- Autosave MUST use a best-effort atomic replace strategy at the file level:
  - write to `<id>.pfx.working.yaml.tmp`
  - then rename/move to `<id>.pfx.working.yaml` (same directory)
- Autosave MUST NOT modify or replace the canonical file.
- The working copy `<id>.pfx.working.yaml` is the ONLY file used for restore.
- `*.tmp` files are staging only and MUST NOT be used for restore prompts.
- Autosave is not considered successful until the `.tmp` has been moved into the
  working copy path.

### Explicit Save rules (user confirmed)

When the user chooses Save (including via back-button prompt):
- The canonical file MUST be replaced atomically.
- Procedure (same directory):
  1) Write canonical temp: `<id>.pfx.yaml.tmp`
  2) Rename canonical -> backup: `<id>.pfx.yaml` -> `<id>.pfx.bak.yaml`
  3) Rename temp -> canonical: `<id>.pfx.yaml.tmp` -> `<id>.pfx.yaml`
  4) Delete working copy: `<id>.pfx.working.yaml`
  5) Delete backup (or keep only briefly; if kept, it MUST be bounded and
     cleaned up on next successful save)

Notes:
- Prefer rename/move operations within the same directory to maximize atomicity.
- If any step fails, the app MUST preserve at least one valid version:
  canonical or backup, and must not leave the project in a corrupted state.

### Open / restore behavior

When opening a project:
- If `<id>.pfx.working.yaml` exists, prompt:
  - Restore unsaved changes (loads working copy into editor)
  - Discard unsaved changes (deletes working copy, loads canonical)
- On startup/open, any leftover `*.tmp` files MUST be deleted.
- Restore prompts are triggered ONLY by the presence of `<id>.pfx.working.yaml`.
- Backup files (`*.bak.yaml`) are internal safety artifacts and MUST NOT be used
  for restore prompts or user-facing recovery.

### Hardware back button behavior (Editor screen)

- Back button MUST NOT silently discard edits.
- Back button MUST follow this pseudocode:

```pseudocode
on_back():
  if !isEditorScreen:
    default_back()
    return

  if isNewProject:
    choice := present_save_discard_cancel()
  else if isDirty:
    choice := present_save_discard_cancel()
  else:
    close_editor_return_to_gallery()
    return

  if choice == CANCEL:
    return

  if choice == SAVE:
    explicit_save_atomic()
    close_editor_return_to_gallery()
    return

  if choice == DISCARD:
    delete_working_copy()
    close_editor_return_to_gallery()
    return
```

Implementation note (Expo FileSystem legacy):
- Use expo-file-system/legacy APIs.
- Best-effort atomic replace MUST be implemented as:
  write to *.tmp -> (delete destination if exists) -> moveAsync tmp into place,
  always within the same directory.
- moveAsync MUST NOT assume overwrite; delete destination first (idempotent).
- isDirty: editor state differs from the last explicit Save (canonical
  baseline), NOT merely from the most recent autosave.

## Internal pixel model (runtime)

Avoid per-pixel React components.

- Internal pixel buffer: Uint32Array (RGBA8888), row-major.
- Palette is part of project; pixels may store palette indices or direct RGBA.
  - For MVP, prefer palette indices for compactness and easier recolors.

Undo/redo:
- Prefer patch-based diffs; if a simple approach is used initially, keep it
  bounded and refactor when canvas > 64x64.

## Export requirements

### SVG export (efficient)

Goal: small, crisp SVG with minimal elements and no seams.

Rules:
- No <defs> for MVP.
- Everything under a single top-level <g>.
- Use integer pixel-unit geometry:
  - x, y, width, height are integers in "pixel units".
- Always include shape-rendering="crispEdges".
- No strokes for pixels in MVP.

Merging rule:
- Convert contiguous same-color pixels into rectangles.
- Prefer fewer rectangles over micro-optimizations.

Seam policy:
- Default: crispEdges + integer geometry only.
- Optional per-project geometry tweak exists to address renderers that show
  outlines/gaps between pixels (see pixelGeometry below).
- Do not silently apply "magic" overlap numbers; if used, it must be explicit
  in the project YAML (pixelGeometry).

### PNG export (pixel-perfect)

- Export lossless PNG at exact dimensions:
  - outputWidth  = width  * scale
  - outputHeight = height * scale
- No smoothing / interpolation.

## YAML project schema (v1)

Projects are stored as a single YAML document with this shape:

- schemaVersion: integer (required)
- id: string (required, stable)
- name: string (required)
- canvas: object (required)
- palette: object (required)
- layers: array (required, can be length 1 for MVP)
- meta: object (required)

Pixels storage:
- Layers store pixel data in one of the allowed encodings (see below).
- Encodings must be deterministic and documented.

Example schema can be found in `./docs/schema.md`.

### Pixel geometry (renderer compatibility)

Some renderers show faint outlines/gaps between adjacent rectangles when
displayed at certain scales. We support per-project geometry settings so the
export can intentionally overlap pixels.

pixelGeometry is stored in YAML and can be used by the SVG/preview renderer:

- pixelSize: integer >= 1 (default: 1)
  - The logical size of a single pixel cell in export space.
  - Typically 1. For "chunky pixels", set to 2, 3, 4...
- bleed: number >= 0 (default: 0)
  - Expands pixel rects by this amount to eliminate gaps.
  - Implemented as: x -= bleed/2, y -= bleed/2, w += bleed, h += bleed.
  - This is explicit and deterministic.
- gridGap: integer >= 0 (default: 0)
  - Optional empty spacing between cells (rare; default 0).
  - If non-zero, pixel cell step becomes (pixelSize + gridGap).

MVP: UI may expose only pixelSize and an advanced toggle for bleed.

## Definition of Done (MVP)

1) Tooling passes:
   - npm ci
   - npm run doctor
   - npm run lint
   - npm run typecheck
   - npm run md:lint

2) App:
   - Create project, draw, undo/redo, autosave, reopen.
   - Export SVG (merged rects, crispEdges, no defs).
   - Export PNG (pixel-perfect, exact scaling).

3) Governance:
   - App.tsx is composition-only.
   - Project persistence is YAML (no JSON persistence path added).
   - Any assumptions are recorded in SCRATCH.md.

## Out of scope (not MVP)

- Online sync / accounts.
- Layers UI beyond on/off and reorder (internals can already support layers).
- Animation, brushes, anti-aliasing.
- Image import / vector tracing.

