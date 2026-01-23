# SCRATCH.md

Current state notes for handoff.

## Assumptions

- App is in App mode with project-specific APP.md already in place.
- YAML is the only on-disk project format; no JSON persistence.
- Pixel buffer uses Uint32Array palette indices (RGBA8888 palette).
- Expo SDK 54 baseline with npm-only tooling.

## TODO

- Re-run full tool suite when resuming work:
  npm run doctor, npm run lint, npm run typecheck, npm run md:lint.
- Commit the latest ISSUES.md + SCRATCH.md updates after review.
