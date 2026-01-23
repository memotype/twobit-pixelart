# ISSUES.md

## Outstanding issues

None.

## Findings

1. [medium] Expo SDK dependency mismatch from template
   - `npm run doctor` reports duplicate and mismatched Expo packages.
   - After running sync-deps, `npm run doctor` now only reports:
     react-native-svg expected 15.12.1 (found 15.13.0).
   - Duplicates for expo-file-system are resolved.
   - Template should pin react-native-svg to 15.12.1 to clear doctor.
