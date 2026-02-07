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
   - Mitigated: checkerboard now renders from a cached tile image repeated
     across the canvas instead of drawing one rect per checker cell.
   - Remaining risk: very large canvas viewports can still spend time on
     repeated tile-image draws; profile in release APK.

3. [medium] Long-stroke lag risk remains under heavy load
   - Architecture fixes applied: gesture worklet sends segment endpoints
     (`fromIndex`, `toIndex`) to JS, interpolation is Bresenham, and editor
     pixels now mutate in a stable in-memory buffer (no per-frame full-buffer
     clone on brush updates). Canvas dirty updates now rerender `CanvasView`
     via an imperative ref instead of rerendering the full editor shell, which
     further reduces frame-time jitter during long strokes. Stroke creation now
     initializes lazily from either start or segment callbacks to avoid an
     initial-gap race when `runOnJS` callback order jitters.
   - Remaining risk: very large canvases can still lag due to per-batch
     `makeImageSnapshot()` and checkerboard draw overhead.
   - Resolution: validate on-device at ~250x250 and, if needed, remove
     per-batch snapshot work and/or cache the checkerboard.
