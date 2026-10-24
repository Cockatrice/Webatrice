---
'@cockatrice/datatrice': patch
---

Internal: the game log's "has left the game" line has one formatter, in `messageLog.ts`, instead of a live copy in the reducer helpers and a dead one in the log module. The logged text and segments are unchanged.
