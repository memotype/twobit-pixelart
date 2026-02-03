# ISSUES.md

## Outstanding issues

None.

## Findings

1. [low] Command separator error while inspecting GalleryScreen
   - PowerShell rejected `&&` when chaining `rg` and `Get-Content`.
   - Resolution: run commands separately or use `;` in PowerShell.
