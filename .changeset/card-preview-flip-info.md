---
'@cockatrice/webatrice': patch
---

Card preview gains a flip-to-info view. An info icon in the top corner of the in-game card preview now flips the card around its vertical axis with a subtle scale dip, revealing Cockatrice-style attributes (Name, P/T, Cost, CMC, Identity, Colors, Type, Side, Layout) plus oracle text sourced from the local Dexie card database. The flipped state persists across hover changes; the preview pane itself scrolls when text is long (thin scrollbar), and the card image now sizes from the available container space rather than hardcoded pixels.
