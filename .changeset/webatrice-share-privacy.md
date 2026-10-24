---
'@cockatrice/webatrice': patch
---

Deck sharing is safer:
- links open only on the server that issued them, and a desktop link needs the server's desktop port set in its settings;
- a cancelled share can't show a stale link;
- revoke failures stay visible;
- shared-deck downloads run one at a time;
- imported copies are matched by request.
