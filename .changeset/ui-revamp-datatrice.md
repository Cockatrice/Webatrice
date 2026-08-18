---
"@cockatrice/datatrice": minor
---

State-layer support for the UI revamp: optimistic card moves, a segmented Cockatrice-parity message log, reveal/peek plumbing, private-chat selectors, and a batch of reducer fixes. Unit test coverage is now ~90%.

**Optimistic mutations.** New `store/games/optimistic.ts` registry (`beginOptimistic` / `isOptimisticPending` / `consumeOptimistic` / `rollbackOptimistic`, key builders `moveOpKey` / `attrOpKey`). The `cardMoved` listener consumes matching pending ops so the server echo of a cross-zone move is not double-applied, reconciles server-corrected positions/ids (a cross-player table-to-table move migrates the optimistic entry to the server's new card id, preserving client-tracked fields like the owner annotation), and the wire layer rolls back on command error.

**Segmented message log.** Every `messageLog.ts` formatter now returns a `LogEntry { text, segments }` (segment kinds `plain`/`player`/`card`/`number`) so the UI can style tokens individually, and `classifyLogTone` buckets lines into `phase`/`turn`/`system`/`action` for color-coding. Log wording is rewritten to Cockatrice-desktop parity (move lines with from-clauses and per-zone phrasing, "turns … face-down", counter totals as "now", coin-flip wording for 2-sided dice, P/T changes reported "from OLD to NEW", possessive arrow lines, translated counter names). New formatters: `formatCardsRevealed`, `formatCardPeeked`, `formatCardUndoneDraw`. `gameMessageAppended` accepts `string | LogEntry`.

**Reveal / zone-view plumbing.** A new `cardsRevealed` listener detects Servatrice auto-top-reveals (suppressing chat spam and the dialog, tracking a persistent `topRevealedCard` per zone), logs peeks per card, and dispatches a new `incomingReveal` state slot (+ `getIncomingReveal` selector) when another player reveals cards to you. Reversed (bottom-N) library views now index correctly (`zoneViewRevealed` carries `isReversed`; reveal ids offset by `cardCount − N`), hidden bottom-view drags reorder within the snapshot, and a cross-zone move into a viewed zone inserts into it (`zoneViewCardInserted`). `PlayerEntry` gains `drawSeq` / `lastDrawCount` (draw beacon), with a `drawBeaconBumped` action.

**New server selectors** for the revamped UI: `getPrivateMessagesForUser` (conversations keyed by the other user's name — backs private chats), `getIsUserAdmin`, `getBanHistoryByUser`, `getWarnHistoryByUser`, `getAdminNotesByUser`.

**Fixes.**

- Bulk untap-all now skips cards flagged "doesn't untap", matching the server's rule.
- Orphan arrows no longer block new arrows after a cross-player move (arrow sweep now also runs on same-zone cross-player moves).
- Moving a card to the stack keeps its annotation (`resetCardState` gains a keep-annotations carve-out); all other non-table zones still clear it.
- A stale top-card face no longer lingers on a pile after a draw, a move from the top, or a shuffle.
- An opponent's undo-draw is now logged for observers (`cardMoved` carries `isUndoDraw`, detected from the event context) instead of being swallowed by the hidden-card early return.

Note: `zoneViewRevealed` (action payload and `GameResponseImpl` bridge method) gains a required `isReversed` argument, and `cardMoved` an optional `isUndoDraw`.
