# ICONS.md

Pixel icon style guide for twobit-pixelart UI assets.

## Icon system

- Base grid: `24x24`.
- Safe area: keep drawing inside coordinates `2..21` (2 px padding each side).
- Pixel units: use only whole 1 px cells; no anti-aliasing.
- Scaling: use integer scale factors only (`1x`, `2x`, `3x`, ...).
- Background: transparent.

## Visual language

- Default stroke weight: `2 px`.
- Interior detail lines: `1 px` only where needed.
- Corners: prefer square corners with occasional stair-step diagonals.
- Fill behavior: prefer solid block shapes over thin outlines.
- Symmetry: use where appropriate for tool icons.

## Consistency rules

- Target visual mass: about `16x16` inside the `24x24` grid.
- Keep similar "ink amount" across icons for visual balance.
- Color count per icon: 1 foreground color, optional 1 accent color.
- No shadows/glows for MVP toolbar icons.

## UI sizing recommendations

- Standard toolbar/rail icon: render at `24dp`.
- Minimum touch target: `44dp x 44dp` regardless of icon size.
- Primary emphasis actions: render at `28dp` to `32dp` as needed.
- Only use a `16x16` icon master when a true compact icon is required.

## Starter icon set

Initial icon family to design in-app:

1. Pencil
2. Eraser
3. Undo
4. Redo
5. Gallery/Back
6. Export SVG
7. Export PNG
8. Menu (hamburger)

## Workflow in twobit-pixelart

1. Create icon project at `24x24`.
2. Keep one layer per icon variant/experiment.
3. Test each icon on light and dark app backgrounds.
4. Export PNG for app integration and SVG as source master.
