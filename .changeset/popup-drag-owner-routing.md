---
"@cockatrice/webatrice": patch
"@cockatrice/datatrice": patch
---

Make zone-view popups (graveyard / exile / library) full drag participants and
route zone moves to the card's owner, matching Servatrice.

Cards in a popup are now draggable — out to the battlefield, into another open
popup, or reordered in place — and a popup is itself a drop target, so cards can
be dragged into it. Moves into a non-table zone (graveyard, hand, exile, library)
now target the card's owner tree rather than the acting player: a controlled
opponent card sent to a non-table zone lands in the owner's zone, never a third
party's, mirroring Servatrice's move rules (`server_abstract_player.cpp`). TABLE
keeps cross-player targeting so giving a card to an opponent (a control-change)
still works.

The open "View library" popup now stays in sync with the deck: when a card
leaves it the snapshot is pruned and re-indexed, and dragging within the popup
reorders the library — both mirroring Cockatrice's live `ZoneViewZone`.

Drag collision detection now respects the popup's stacking: because a zone-view
popup floats above the board, a card dropped onto it routes into the popup's zone
(rather than the board droppable underneath), and a card dropped on visible board
lands there even when a popup overlaps elsewhere on screen.
