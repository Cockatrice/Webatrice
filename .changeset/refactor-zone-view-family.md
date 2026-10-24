---
'@cockatrice/webatrice': patch
---

The game's floating card views (the zone view, the top / bottom N view and the incoming-reveal view) now share one implementation of their geometry, view choices, card metadata, card layout and marquee selection, and one translatable list of zone names; their titles ("P2 reveals their library", "Top 3 cards — P1") are translated as whole sentences, so a language can order and inflect them. A size or position remembered on a larger screen is now kept within the viewport the same way for all three: the incoming-reveal view no longer opens larger than the window, and the reveal views restore a partly off-screen position as the zone view does, keeping the title bar reachable. On a window smaller than a view's minimum size, the view now shrinks to fit the window rather than overflowing it.
