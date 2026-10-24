---
'@cockatrice/datatrice': patch
---

A deck storage upload or update acknowledgement no longer erases the deck's stored metadata. Servatrice answers with only the id, name, upload time and visibility, so the colour identity, banner and tags the client already holds are kept.
