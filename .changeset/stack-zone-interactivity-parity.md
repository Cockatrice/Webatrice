---
'@cockatrice/webatrice': patch
---

Stack zone now behaves like the other zones: cards on the stack are real `CardSlot`s, so right-click opens the card context menu, they can be arrow sources and targets, they emit hover/click/double-click into the shared `GameInteractionContext`, and they are draggable. The stack column itself is also a drop target — drag a card from hand or battlefield onto the stack to move it there (`moveCard` with `targetZone=STACK`). The drop zone is gated on `canAct`, so the opponent's stack does not light up.
