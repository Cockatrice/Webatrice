---
'@cockatrice/webatrice': patch
---

Arrows created from the Cockatrice desktop client now render with a visible line, not just the arrowhead. Cockatrice's C++ color helper omits the alpha field on the wire, which bufbuild surfaces as `0`; the overlay now treats unset alpha as fully opaque.
