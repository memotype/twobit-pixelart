# Example project schema

````yaml
# Pixel Forge project schema (v1)
# Canonical file extension suggestion: .pfx.yaml (or .pix.yaml)
#
# Notes:
# - Deterministic ordering: writers MUST output keys in the order shown here.
# - Unknown keys are allowed only under `extensions`.
# - All numeric fields must be plain decimal (no scientific notation).

schemaVersion: 1

id: "proj_01J..."          # stable identifier (uuid or ulid style)
name: "My Sprite"

canvas:
  width: 32                # integer >= 1
  height: 32               # integer >= 1
  background: null         # null or "#RRGGBB" or "#RRGGBBAA"

pixelGeometry:
  pixelSize: 1             # integer >= 1 (logical pixel cell size)
  gridGap: 0               # integer >= 0 (space between cells)
  bleed: 0.0               # number >= 0.0 (rect overlap to avoid seams)

palette:
  format: "rgba8888"       # fixed for v1
  colors:                  # index 0..N-1
    - "#00000000"          # allow alpha; index 0 may be "transparent"
    - "#000000FF"
    - "#FFFFFFFF"
    - "#FF0000FF"

layers:
  - id: "layer_01J..."
    name: "Layer 1"
    visible: true
    opacity: 1.0           # 0.0..1.0; exporters may bake this or ignore in MVP
    blendMode: "normal"    # reserved; "normal" only for MVP
    pixels:
      encoding: "index_rle_v1"
      # The layer is width*height cells.
      # index_rle_v1 is row-major run-length encoding of palette indices.
      #
      # runs is an array of [count, index] pairs.
      # Example: [ [10,0], [1,2], [21,0], ... ]
      #
      # Constraints:
      # - count is integer >= 1
      # - index is integer >= 0 and < len(palette.colors)
      # - total counts MUST equal width*height
      runs:
        - [1024, 0]

meta:
  createdAt: "2026-01-22T14:00:00-05:00"
  updatedAt: "2026-01-22T14:00:00-05:00"
  app:
    name: "Pixel Forge"
    version: "0.1.0"

extensions: {}             # optional; app-specific future fields only
````
