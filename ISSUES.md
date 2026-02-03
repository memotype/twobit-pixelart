# ISSUES.md

## Outstanding issues

None.

## Findings

1. [low] Command separator error while inspecting GalleryScreen
   - PowerShell rejected `&&` when chaining `rg` and `Get-Content`.
   - Resolution: run commands separately or use `;` in PowerShell.

2. [medium] Drawing continues when dragging over right-side menu
   - Dragging from the canvas into the right rail keeps the active stroke
     alive, so pixels update while the finger is over the menu.
   - Resolution: end the stroke when the pointer leaves canvas bounds.
