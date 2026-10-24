---
'@cockatrice/sockatrice': minor
---

`deckUpdate` accepts an optional completion callback that receives the server's reply for that request, so a caller can match each acknowledgement to the save it sent. Existing callers and the datatrice response path are unchanged.
