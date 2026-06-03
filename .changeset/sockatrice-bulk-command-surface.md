---
"@cockatrice/sockatrice": patch
---

Own the bulk card-command surface and the canonical zone-name wire constants.

`ZoneName` (and `ZoneNameValue`) — the server-defined zone wire strings
(`table`/`grave`/`rfg`/`hand`/`deck`/`sb`/`stack`) — now live here and are exported
from the package entry, since they are a protocol concern rather than a store one.

A new `commands/game/bulk/` module exposes the multi-card commands on
`request.game.*` — `bulkTap`, `bulkDoesntUntap`, `bulkFlip`, `bulkPeek`, `bulkMove`
(one file per command). Each applies Cockatrice's collective rule (e.g. any untapped
=> tap all), skips no-op cards, and batches every per-card command into a single
`CommandContainer` (one `cmd_id`, one atomic server response), grouping foreign-owner
commands under one `Command_Judge` per target. Also adds `moveTargetPlayerId` (the
Servatrice non-table move-routing rule) and the `CardLocation` / `BulkMoveDestination`
/ `JudgeTarget` types. These previously lived in webatrice; relocating them keeps the
Cockatrice command surface defined once in the protocol layer.
