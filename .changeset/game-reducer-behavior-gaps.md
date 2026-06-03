---
"@cockatrice/datatrice": patch
---

Close four behavior gaps in the game reducer layer found while reviewing the
opponent-mulligan fix.

- A shuffle now clears the shuffled zone's known-card tracking (order/byId) and any
  open "View library" snapshot, preserving cardCount. Servatrice reveals real card ids
  to the owner when cards move from the hand (a PrivateZone) into the library (a
  HiddenZone), so the client tracked them and rendered a face-up known card on top of
  the library after a mulligan; Event_Shuffle is the only post-shuffle signal, so the
  client must drop those now-randomized positions on it.
- getSeatedPlayers is memoized so an unchanged seating returns the prior array by
  reference, sparing board/reveal consumers a re-render on every unrelated mutation.
- activePlayerSet no longer logs a turn change before the game has started, matching the
  existing activePhaseSet guard.
- A full gameStateChanged resync (e.g. a spectator joining) now carries an open "View
  library" snapshot (revealedCards) forward per zone, the same way it preserves userInfo,
  instead of dropping it.
