---
'@cockatrice/webatrice': patch
---

Removed the right-sidebar "Rotate 90°" button. The toggle was a CSS `transform: rotate(90deg)` on the whole board and was mis-attributed to desktop's `Player::actRotateLocal` — that desktop action actually rotates **player seating order**, which Webatrice already exposes via the slot-A/slot-B player dropdowns. The board no longer spins.
