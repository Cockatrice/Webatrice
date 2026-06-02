---
"@cockatrice/sockatrice": patch
"@cockatrice/webatrice": patch
---

Let judges act on any player's cards, routing every action through Command_Judge.

A judge can already join/create a game as judge, and drag opponents' cards, but
the card context menu was hard-gated to owned cards. The writeable menu (move,
tap, flip, face-down, doesn't-untap, P/T, annotation, counters, peek, attach) now
opens on any card for a judge — parity with Cockatrice's
`writeableCard = getLocalOrJudge()`.

Because the per-card commands (`setCardAttr`, `flipCard`, `incCardCounter`,
`setCardCounter`, `attachCard`, `revealCards`) carry no player id, a judge acting
on a card they don't own now wraps the command in `Command_Judge(target_id=owner)`
so the server executes it as the owner — exactly as Cockatrice's centralized
`PlayerActions::sendGameCommand` does. `moveCard` is wrapped too (for correct
forced-by-judge attribution and owner-context permission checks), and the drag and
multi-select bulk paths use the same wrapping. Own-card actions are unchanged and
still sent bare. Play stays own-card-only for now (its play path isn't
judge-wrapped yet).
