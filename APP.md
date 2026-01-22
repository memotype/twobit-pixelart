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

