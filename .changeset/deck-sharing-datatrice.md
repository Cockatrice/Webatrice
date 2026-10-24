---
'@cockatrice/datatrice': minor
---

Stores Cockatrice 3.1 deck sharing (#7241). The server slice keeps the caller's share links (`deckSharesMine`, selector `getDeckSharesMine`, emptied by `deckShareRemoved`) and other users' public deck trees (`publicDecks`, selector `getPublicDecks(state, userName)`). A visibility change updates the stored deck tree's public bit for the deck or folder. New signal actions `deckShareCreated`, `deckShareListed`, `deckShareDownloaded` and `publicDeckDownloaded` report the one-off answers; failures arrive through the existing `sessionCommandFailed`. `deckShareCreated` carries the optional `requestId` of the request it answers; it is never stored. Deck upload success and failure actions carry the optional `requestId` too.
