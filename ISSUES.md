# ISSUES.md

## Outstanding issues

1. [low] Checkerboard draws many rects per frame (deferred)
   - Mitigated: checkerboard now renders from a cached tile image repeated
     across the canvas instead of drawing one rect per checker cell.
   - Status: performance feels smooth even at very large canvases; keep this
     noted in case device-specific reports surface later.
   - Resolution (if needed): increase checker tile size, reduce draw calls, or
     cap checker draws to the visible area.
2. [low] Long-stroke lag risk remains under heavy load (deferred)
   - Status: drawing feels smooth in current testing; not a release blocker.
   - Resolution (if needed): revisit per-batch snapshot work or throttle
     dirty-pixel flush cadence after profiling on weaker devices.

## Findings

None.
