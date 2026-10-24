---
'@cockatrice/webatrice': patch
---

Dragging cards within your own hand now reorders them. The drop used to be discarded as a same-zone no-op; it now sends `Command_MoveCard` from hand to hand at the drop slot, as desktop does, so your hand order updates (other players never see the order of a private zone). A multi-card selection keeps its order and lands together at the drop slot. Dropping a hand card back on the *View hand* dialog still does nothing.
