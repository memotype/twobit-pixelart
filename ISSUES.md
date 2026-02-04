# ISSUES.md

## Outstanding issues

None.

## Findings

1. [medium] Skia snapshot is recreated after each draw batch
   - `CanvasView` now updates a persistent surface in place, but still calls
     `makeImageSnapshot()` each batch, which can be expensive at larger sizes.
   - Resolution: draw directly from a mutable texture/surface node (no per-batch
     snapshot), or reduce snapshot frequency while drawing.

2. [medium] Checkerboard draws many rects per frame
   - `checkerRects` still creates many Skia rect draws at large scales, which
     adds overhead on top of the bitmap work.
   - Resolution: replace with a small tiled pattern or cached bitmap.

3. [low] RAF flush is not cancelled on unmount
   - `EditorScreen`/`EditorScreenV2` schedule RAF flushes but never cancel on
     unmount, which can set state after unmount in edge cases.
   - Resolution: cleanup pending RAF in a `useEffect` teardown.

4. [medium] Long-stroke lag risk remains under heavy load
   - Architecture fix applied: gesture worklet now sends segment endpoints
     (`fromIndex`, `toIndex`) to JS, and interpolation runs in JS with
     Bresenham stepping. This removes large per-update index arrays from
     `runOnJS` traffic and should reduce bridge pressure while preserving
     full pixel fidelity.
   - Remaining risk: very large canvases can still lag due to per-batch
     `makeImageSnapshot()` and checkerboard draw overhead.
   - Resolution: validate on-device at ~250x250 and, if needed, remove
     per-batch snapshot work and/or cache the checkerboard.
