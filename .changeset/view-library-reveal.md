---
"@cockatrice/sockatrice": minor
"@cockatrice/datatrice": minor
"@cockatrice/webatrice": patch
---

Fix the View Library flow so the deck's cards are actually revealed.

Opening "View library…" now sends `Command_DumpZone` and consumes the
`Response_DumpZone` card list the server returns to the requester, routing it
into the store (new `ZoneEntry.revealedCards` with `zoneViewRevealed` /
`zoneViewCleared` reducers and a `getRevealedCards` selector). The popup reads
the revealed cards from the store and renders them face-up, and a Cockatrice-
parity "Shuffle on close" checkbox (deck only, default on) sends
`Command_Shuffle` when the view is closed.

Also stops pre-bundling the `@cockatrice/*` workspace packages in webatrice's
vite `optimizeDeps` so `npm run start` reliably reflects dependency rebuilds
instead of serving a stale pre-bundle.
