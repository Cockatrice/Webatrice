---
'@cockatrice/webatrice': patch
---

The game board no longer requests `api.scryfall.com/cards/?format=image` for deck cards without a Scryfall id; it prefetches their images by exact name, the same URL the card later shows.
