---
"@cockatrice/datatrice": patch
---

Keep an opponent's hand and library counts in sync through a mulligan.

When an opponent mulligans, Servatrice returns their whole hand to the library and
redraws (N x `Event_MoveCard` hand-to-library, then `Event_Shuffle`, then
`Event_DrawCards`). For an observer the hand and library are hidden zones, so each
hand-to-library `Event_MoveCard` carries `card_id = -1` with an unresolvable position.
The `cardMoved` listener previously early-returned on any move it couldn't tie to a
known card, so those transfers never adjusted the zone totals -- the subsequent draw
then inflated the hand and shrank the library (a same-size mulligan left the hand at
double size and the library short by a full hand).

The listener now performs a count-only transfer for genuinely hidden cross-zone moves,
decrementing the source zone's `cardCount` and incrementing the target's (reusing the
existing `zoneCardCountAdjusted` primitive). The fix is general: it also corrects any
other hidden opponent move, such as a discard from hand or a hand to top-of-library
move. The local player's own mulligan was unaffected because their cards carry real ids.
