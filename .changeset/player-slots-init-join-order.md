---
'@cockatrice/webatrice': patch
---

Fix four related player-slot issues in the game view:

- A lone player (e.g. host who readies before anyone joins) no longer renders on both sides of the board. Slot B stays empty until a second player is seated, and the board grid drops the hand-zone row so the battlefield fills the space.
- Slot defaults now follow the order players joined, not numeric `playerId` order.
- The hand zone no longer renders for spectators (it's the local-player's hand UI; spectators are always viewing someone else).
- Selecting a player who is already in the other slot now swaps the two slots instead of collapsing both onto the same player.
