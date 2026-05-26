---
'@cockatrice/webatrice': patch
---

Render both player hands when the game's `spectators_omniscient` flag is on. Seated players continue to see their own hand at the bottom and now also see the opponent's hand at the top; spectators see both hand zones (previously they saw none). Hand zones render upright in both slots — no rotation — so all card art is readable from the viewer's perspective. The grid layout collapses cleanly when one or both hands are hidden.
