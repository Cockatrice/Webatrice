---
"@cockatrice/sockatrice": minor
---

Protocol-layer additions for the UI revamp: a heterogeneous bulk counter command, per-command options plumbing, undo-draw detection, reversed zone-view support, and a sanitizer robustness fix.

- **New `request.game.bulkSetCardCounterEntries`** (+ exported `CardCounterEntry` type): batches per-card `Command_SetCardCounter` entries with heterogeneous `(cardId, counterId, counterValue)` values into a single `CommandContainer`, judge-wrapped per card owner — unlike `bulkSetCardCounter`, which applies one value to every target. Backs the "increment all card counters" context-menu action (Cockatrice `actIncrementAllCardCounters` parity).
- **Command options plumbing.** `moveCard`, `setCardAttr`, `incCardCounter`, `setCardCounter`, `incCounter`, `setCounter`, `setActivePhase`, and `createArrow` gain a trailing optional `options` parameter (spread into `sendGameCommand`), so callers can attach command options — e.g. grouping actions into one undo step — that previously had no way through. Backward-compatible.
- **Undo-draw detection.** The `moveCard` event handler inspects the event context for `Context_UndoDraw_ext` and passes a new optional `isUndoDraw` flag to `IGameResponse.cardMoved`, letting consumers log "undoes their last draw" instead of a generic move.
- **Reversed zone views.** `dumpZone` now forwards the request's `isReversed` flag into the `zoneViewRevealed` response callback (new required parameter on `IGameResponse.zoneViewRevealed`), so bottom-N library views preserve their ordering direction.
- **Fix: `sanitizeHtml` no longer breaks when imported before a `window` exists** (worker / test import order). DOMPurify is now created lazily and memoized on first use, the link hook (`target="_blank"` + `rel="noopener noreferrer"`) registers defensively, and if no real instance is available the input is returned unmodified rather than throwing.
