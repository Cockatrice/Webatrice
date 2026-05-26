---
'@cockatrice/webatrice': patch
---

Battlefield scrolling and arrow anchoring improvements: stack columns now scroll vertically when card count overflows the available height, the three battlefield lanes for one player share a single horizontal scrollbar (so columns stay aligned across rows instead of drifting independently), and the arrow overlay re-anchors in real time on any scroll via a capturing scroll listener on `window` (rAF-coalesced).
