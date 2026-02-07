# SVG Parameterization Schema (Draft v1)

This schema defines a human- and GPT-readable way to format SVG pixel art
with universal renderer compatibility and optional parameterized colors.
It assumes a pure-rect SVG with crisp edges, no filters, no strokes.

Schema version: 1

Goals:
- Render correctly in any standard SVG viewer.
- Allow fast, deterministic color parameterization by tools.
- Keep results deterministic and offline-friendly.

Non-goals:
- CSS or `<defs>` usage (optional mode may add CSS vars later).
- Complex selectors or scripting.

## Core rules (universal support)

1) Always emit a valid SVG with standard fills (hex colors).
2) Use a single `<g>` for pixel rectangles.
3) Use integer coordinates and sizes.
4) Keep `shape-rendering="crispEdges"`.

## Parameterization rules (metadata-driven)

Each pixel rectangle (or group of rectangles) MAY include optional metadata
that declares a "color token". This metadata does not affect rendering but
enables external tools to replace fills efficiently.

### Token naming

- Token names are ASCII, uppercase, and use underscores only.
- Allowed: `A-Z`, `0-9`, `_` (no spaces).
- Max length: 32 characters.
- Example: `SKIN_TONE`, `PRIMARY`, `ACCENT_1`.

### Token placement

Attach token metadata to the smallest group that shares a color.
Prefer one token per `<g>` to avoid per-rect attributes.
Do not nest tokenized groups inside other tokenized groups.

### Required attributes for tokenized groups

- `data-token="TOKEN_NAME"`
- `fill="#RRGGBB"` or `fill="#RRGGBBAA"`

Example:

```svg
<g data-token="SKIN_TONE" fill="#F2C7A5" shape-rendering="crispEdges">
  <rect x="0" y="0" width="1" height="1" />
</g>
```

### Rects (pixel geometry)

```svg
<rect x="10" y="3" width="1" height="1" />
```

No stroke. No transforms. No fractional coordinates.

## Format summary

- Top-level SVG:
  - `xmlns`
  - `version`
  - `viewBox`
  - `shape-rendering="crispEdges"`
  - `image-rendering="pixelated"` (optional)
- One parent `<g>` for all pixels.
- Optional nested `<g>` elements for tokenized colors.
- All rects are inside the pixel groups.

## Parameterization flow (external tool)

1) Parse SVG and find any elements with `data-token`.
2) For each `data-token`, replace `fill` with the desired color.
3) Leave geometry unchanged.

This yields O(N) scanning with trivial string replacement.

## Determinism guarantees

- Same input pixels and palette order produce the same SVG text.
- Token names are stable and derived from palette entries.
- If a token is not defined, the file still renders using the `fill` value.
- Group order SHOULD be deterministic:
  - sort by token name, then by rect order (row-major).

## Assumptions

- Palette entries may optionally include a token name.
- If multiple colors share a token, they are grouped together.
- If a token is duplicated by mistake, the file keeps each group
  separate but uses the same token name.

## Validation (conformance)

A file is compliant if:
- All rects use integer coordinates and sizes.
- All fills are valid hex colors.
- Any `data-token` values match the token naming rules.
- No nested tokenized groups exist.

Tools MAY accept non-compliant files but should treat them as best-effort.

## Alpha handling

- Preferred: `#RRGGBBAA`.
- Optional: `fill-opacity` for tools that cannot emit 8-digit hex.
- Do not mix `#RRGGBBAA` and `fill-opacity` in the same file.

## Examples

Minimal example (single token):

```svg
<svg xmlns="http://www.w3.org/2000/svg" version="1.1"
  viewBox="0 0 2 1" shape-rendering="crispEdges">
  <g data-token="PRIMARY" fill="#FF0000">
    <rect x="0" y="0" width="1" height="1" />
    <rect x="1" y="0" width="1" height="1" />
  </g>
</svg>
```

Multi-token example:

```svg
<svg xmlns="http://www.w3.org/2000/svg" version="1.1"
  viewBox="0 0 2 2" shape-rendering="crispEdges">
  <g>
    <g data-token="PRIMARY" fill="#FF0000">
      <rect x="0" y="0" width="1" height="1" />
    </g>
    <g data-token="ACCENT_1" fill="#00FF00">
      <rect x="1" y="0" width="1" height="1" />
    </g>
    <g fill="#0000FF">
      <rect x="0" y="1" width="1" height="1" />
      <rect x="1" y="1" width="1" height="1" />
    </g>
  </g>
</svg>
```

## Optional future extension (not required)

CSS variable mode:
- `fill="var(--TOKEN_NAME, #RRGGBB)"`
- Still include `data-token` for compatibility.
