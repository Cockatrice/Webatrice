---
"@cockatrice/webatrice": patch
---

Size the hand zone proportionally to the board instead of a fixed 176px height.
In all-hands (omniscient) games the inline hand previously consumed roughly half
of each player's cell — in 3-player mode it dominated the battlefield. Each inline
hand now takes 25% of its cell, leaving the battlefield ~75%, and the bottom hand
bar scales with the board height (clamped so it stays usable on short/tall
viewports). Hand cards already size to fill the zone, so they scale with it.
