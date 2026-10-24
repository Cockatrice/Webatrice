---
'@cockatrice/datatrice': minor
---

Handle Sockatrice's new `deckUpdate` answers. `updateServerDeck` dispatches `deckUpdated`, which replaces the deck's entry in the storage tree by id (the server re-derives its name), and `updateServerDeckFailed` dispatches the `deckUpdateFailed` signal (`DECK_UPDATED` / `DECK_UPDATE_FAILED`).
