---
'@cockatrice/webatrice': patch
---

Fix: right-click-dragging an arrow between cards no longer opens the target card's context menu on release. The post-mouseup `contextmenu` suppression now runs in the capture phase and calls `stopPropagation()`, so the event is intercepted before React's delegated root listener can open the card menu.
