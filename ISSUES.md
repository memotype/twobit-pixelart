# ISSUES.md

## Outstanding issues

None.

## Findings

1. [medium] Expo SDK dependency mismatch from template
   - `npm run doctor` reports duplicate and mismatched Expo packages.
   - Duplicates: expo-file-system@18.1.11 in app deps vs
     expo-file-system@19.0.21 under expo.
   - Mismatches: expo-file-system expected ~19.0.21 (found 18.1.11),
     expo-sharing expected ~14.0.8 (found 13.1.5),
     react-native-svg expected 15.12.1 (found 15.13.0),
     expo expected ~54.0.32 (found 54.0.31).
   - This is a template defect per APP.md; do not fix here. Update the
     template dependencies to match Expo SDK 54.
