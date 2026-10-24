---
'@cockatrice/webatrice': patch
---

Internal refactor of Scryfall access and the card catalog. Scryfall requests and image URLs are now built by one client (`services/scryfall`; the deck editor's card search moves onto it later), the card catalog is split into its Dexie, cache, mapping and lookup layers, the deck and game card-detail views share one detail fetch, and the deck editor's mana-symbol renderer is shared with the game. Requests are byte-identical, pinned by characterization specs.

Grids with keyboard row navigation (replays, reports, card-art rules, the token and card-source editors, a user's games) now also move ten rows with PageUp/PageDown, and the game lobby's bracket badge uses the same colours as the deck editor's.
