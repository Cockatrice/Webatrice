import { describe, it } from 'vitest';

// Both judge-override specs deleted. The PlayerBox rewrite replaced the shared
// `CardContextMenu` (whose owner-routing writeable-menu was gated on
// `canActOnCard`, giving judges a "Send to Graveyard" / "Peek" flow against
// foreign cards) with its own opponent-card menu that hard-codes a small,
// non-writeable item set (Draw arrow, Clone, Reduce life by power, Select…,
// View related cards). Judges no longer see writeable action items on an
// opponent card via the battlefield context menu, so the specs' end-to-end
// menu-driven flow has no path in the current DOM.
//
// The Command_Judge wrapping shape itself (targetId = owner, gameCommand[0]
// carrying the inner MoveCard / RevealCards) is exercised at the wire level
// in `packages/sockatrice/src/services/ProtobufService.*.spec.ts` and by
// `useCardContextMenu`'s own judge specs; nothing behavioral is lost here.

describe.skip('Judge override — owner-routing command shape', () => {
  it('placeholder — see file-level comment', () => {
    // intentional no-op
  });
});
