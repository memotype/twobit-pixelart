# ISSUES.md

## Outstanding issues

1. [medium] Gallery list uses updatedAt raw ISO string
   - The Gallery shows raw ISO timestamps (e.g., 2026-01-22T14:00:00Z),
     which is not user friendly and impacts readability.
   - Consider: format into a human-readable local time or relative label.

2. [low] Create button uses fixed color ignoring theme contrast
   - The create button is hard-coded to #c6c6c6 with #000000 text, which
     may be low-contrast in dark mode or if backgrounds change.
   - Consider: theme-aware neutral with contrast checks or keep per-theme
     values in theme.ts.

## Findings

1. [low] Expo doctor reports Expo patch mismatch
   - `npm run doctor` failed on 2026-02-01. Expo SDK expects `expo` ~54.0.33
     but `package.json` has 54.0.32.
   - Resolution: align `expo` to ~54.0.33 (likely via `npm install`) and rerun
     `npm run doctor`.
