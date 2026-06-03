---
"@cockatrice/datatrice": patch
"@cockatrice/webatrice": patch
---

Harden the game store against the Immer / protobuf-es hazard and optimize game-board rendering.

- **Store (datatrice):** reducers across the games/rooms/server slices now clone-and-reassign protobuf-es messages instead of mutating them in place. Immer can't draft proto2 messages, so in-place writes (`counterSet`, `adjustMod`, `replayModifyMatch`, `playerPropertiesUpdated`, and the room/game list merges) went untracked, and several spreads dropped unset proto2 fields. Adds a `cloneWith` helper and a `dequal` dependency.
- **Attachment selector:** `getAttachmentsByParent` returns a stable reference when the attachment graph is unchanged (reselect `lruMemoize` + `dequal`), so a single card mutation no longer rebuilds-and-re-renders the whole battlefield.
- **Render (webatrice):** battlefield row/column card arrays are reference-stabilized, and `Battlefield`/`HandZone`/`PlayerList`/`PlayerInfoPanel` are memoized, so tapping one creature re-renders only that card's subtree instead of the entire board and sidebar.
