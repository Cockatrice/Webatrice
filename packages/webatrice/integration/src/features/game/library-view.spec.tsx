import { describe, it } from 'vitest';

// Both tests deleted: the PlayerBox rewrite replaces the legacy `zone-stack-deck`
// click path (which invoked `onZoneClick` → `useGameDialogs.handleZoneClick` and
// popped the shared `ZoneViewDialog`) with an inline "View library" flow that
// opens PlayerBox's own `LibrarySearchDialog`. PlayerBox no longer wires
// `useGameInteraction.onZoneClick`, so the specs' end-to-end flow (click the
// deck stack → dump command → asserts against `zone-view-dialog` / `zone-view-card-N`)
// has no runnable path in the current DOM. The store-side pruning invariant that
// the second test covered is exercised at the reducer level in
// `packages/datatrice/src/store/games/game.reducer.*.spec.ts` and by the
// `useZoneViewDialog` unit spec, so nothing behavioral is lost from the removal.

describe.skip('View library popup', () => {
  it('placeholder — see file-level comment', () => {
    // intentional no-op
  });
});
