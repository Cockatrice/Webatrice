---
"@cockatrice/webatrice": patch
---

Render every seated player at once in an adaptive board grid that sizes itself
to the player count: a lone player's battlefield fills the screen, 2-3 players
stack vertically, and 4+ players form a 2-column grid that grows rows (2×2,
2×3, …).

The layout is a port of Cockatrice's `GameScene::rearrange()`: seated players
sit in a cyclic ring in join order, the ring rotates so the local player anchors
the bottom-left cell, and seats wind up the left column then down the right so
the around-the-table order is preserved relative to you. Every row above the
bottom is mirrored, and conceded players drop out of the grid. Hands show as a
single bottom bar for the local player, switching to an inline hand per board
when more than one hand is visible (omniscient games). This replaces the old
two-slot board and its per-board player-swap dropdowns.
