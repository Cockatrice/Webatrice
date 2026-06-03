---
"@cockatrice/webatrice": patch
---

Consume the bulk card-command surface from sockatrice instead of local dispatchers.

The local `bulkCardActions.ts` and `moveTarget.ts` utils are removed; the card context
menu and double-click tap now call `webClient.request.game.bulkTap` / `bulkFlip` /
`bulkDoesntUntap` / `bulkPeek` / `bulkMove`, and `moveTargetPlayerId` is imported from
`@cockatrice/sockatrice` (used by drag-and-drop and the move-to-library dialog).
`SelectedCard` aliases sockatrice's `CardLocation`. Zone-name references now import
`ZoneName` from `@cockatrice/sockatrice`. No user-facing behavior change — single and
multi-card Tap / Doesn't Untap / Flip / Peek / Move still produce one atomic command
per gesture, judge-wrapped for foreign owners.
