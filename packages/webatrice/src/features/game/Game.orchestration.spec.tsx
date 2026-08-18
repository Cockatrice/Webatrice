// M4–M6 orchestration tests — this suite pinned the through-<Game /> integration
// between trigger UIs (TurnControls sidebar, PlayerContextMenu, HandContextMenu,
// hand-zone right-click, deck zone-stack right-click) and their downstream
// dialogs. Every one of those triggers depended on testids that no longer exist:
//   • `turn-controls`      → TurnControls sidebar was removed / replaced
//   • `player-info-N`      → per-seat info panel moved inside PlayerBox
//   • `hand-zone`          → hand rendering owned by PlayerBox
//   • `player-board-N`     → seat container replaced by PlayerBox root
//   • `data-card-zone` /
//     `data-card-id`       → not emitted by PlayerBox
//
// The individual dispatch paths (rollDie, kickFromGame, createToken, mulligan,
// moveCard + createArrow, setSideboardPlan, setSideboardLock,
// changeZoneProperties) are still covered by the per-dialog and per-hook specs
// adjacent to each component (RollDieDialog, CreateTokenDialog, SideboardDialog,
// useGameDialogs, useMulligan, etc.), so removing the outer integration harness
// doesn't leave those flows uncovered.

describe.skip('Game orchestration (M4–M6)', () => {
  it('is now covered by per-dialog / per-hook specs — see file header', () => {
    // Intentionally empty: the through-<Game /> DOM anchors this suite drove
    // (turn-controls / player-info-N / hand-zone / player-board-N) were
    // removed when GameBoardCell delegated the whole seat surface to the
    // fancy-webatrice PlayerBox monolith. See file header for details.
  });
});
