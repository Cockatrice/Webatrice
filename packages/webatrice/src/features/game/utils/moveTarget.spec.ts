import { Enriched } from '@cockatrice/datatrice';

import { moveTargetPlayerId } from './moveTarget';

describe('moveTargetPlayerId', () => {
  it('routes non-table moves to the card owner, ignoring the requested target', () => {
    // Owner 2, acting player 1 → grave/hand/exile/library all land in owner 2's tree.
    expect(moveTargetPlayerId(2, Enriched.ZoneName.GRAVE, 1)).toBe(2);
    expect(moveTargetPlayerId(2, Enriched.ZoneName.HAND, 1)).toBe(2);
    expect(moveTargetPlayerId(2, Enriched.ZoneName.EXILE, 1)).toBe(2);
    expect(moveTargetPlayerId(2, Enriched.ZoneName.DECK, 1)).toBe(2);
  });

  it('keeps the requested target for TABLE (a legal cross-player control-change)', () => {
    expect(moveTargetPlayerId(2, Enriched.ZoneName.TABLE, 1)).toBe(1);
  });

  it('is a no-op for a self-owned card (owner === local)', () => {
    expect(moveTargetPlayerId(1, Enriched.ZoneName.GRAVE, 1)).toBe(1);
  });
});
