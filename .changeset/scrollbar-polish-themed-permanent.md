---
'@cockatrice/webatrice': patch
---

Themed permanent scrollbars on battlefield, hand, and stack zones. Horizontal scrollers use `overflow-x: scroll` so the thin themed scrollbar is permanent — no layout shift on overflow toggle. The stack column uses `overflow-y: auto` + `scrollbar-gutter: stable both-edges` so reserved gutters stay symmetric and cards remain visually centered. Stack column widened to 96 px (1.5× the card width, matching Cockatrice's `StackZone::boundingRect`); player board grid track updated accordingly. Hand zone moves horizontal padding onto the inner scroll container so the scrollbar spans the full width.
