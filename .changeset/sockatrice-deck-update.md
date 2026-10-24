---
'@cockatrice/sockatrice': minor
---

Add `deckUpdate(deckId, deckList, isPublic?, colorIdentity?)`, which replaces an existing deck in server storage (desktop's remote "Save deck"). It sends `Command_DeckUpload` without `path`: Servatrice creates a new deck whenever `path` is present, even empty, which `deckUpload` always sets. 3.1 servers overwrite the stored color identity on every update, so pass `colorIdentity` each time as desktop does; `isPublic` changes visibility only when given. The answer arrives through two new session response callbacks, `updateServerDeck(deckId, treeItem)` and `updateServerDeckFailed(deckId, responseCode, failure?)` (the same shape as the other deck command failures), which are optional members of `ISessionResponse`, so existing implementations still compile.
