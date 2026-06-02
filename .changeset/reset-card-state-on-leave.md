---
"@cockatrice/datatrice": patch
---

Reset a card's battlefield-only state when it leaves the battlefield.

Webatrice previously preserved a card's `tapped` status (and other battlefield-only
attributes) when it moved zones, so a tapped creature stayed "tapped" in the graveyard
or hand. `Event_MoveCard` carries none of these fields and Servatrice emits no
per-attribute reset event, so — exactly as Cockatrice's desktop client does via
`CardItem::resetState()` — the client now wipes the transient state on a
`TABLE → non-TABLE` move.

A new `resetCardState()` helper clears `tapped`, `attacking`, `doesntUntap`, `pt`,
`color`, `annotation`, and `counterList` (previously only `counterList` was cleared).
Moves within the battlefield and between non-table zones are unaffected.
