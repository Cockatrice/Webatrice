---
"@cockatrice/webatrice": patch
---

Reveal face-down cards through the flip command so they render after resuming a game.

The card context menu's "Face Up/Face Down" toggle sent setCardAttr(AttrFaceDown), whose
Event_SetCardAttr carries no card identity. After resuming an in-progress game the client has no
local identity for a face-down card (the server sends face-down cards with an empty name, and the
provider id is usually empty), so turning it face up that way left it with nothing to render and
the image was blank. The toggle now uses Command_FlipCard, whose event reveals the card's
name/providerId when it turns face up. The redundant separate "Flip" menu item (which already used
the flip command) is removed, leaving the clearer "Face Up/Face Down" label as the single
face-down toggle.
