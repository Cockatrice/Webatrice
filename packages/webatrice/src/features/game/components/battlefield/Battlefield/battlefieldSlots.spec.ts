import type { BattlefieldCardViewModel } from '../../ui/PlayerBoard/playerBoard.types';
import { battlefieldSlots } from './battlefieldSlots';

const card = (id: number, row: number, col: number, extra: Partial<BattlefieldCardViewModel> = {}): BattlefieldCardViewModel =>
  ({ id: String(id), name: `Card ${id}`, scryfallId: '', slot: { row, col }, subSlot: 0, ...extra }) as BattlefieldCardViewModel;

describe('battlefieldSlots', () => {
  it('leaves cards attached on this battlefield out of the grid and counts them on their parent', () => {
    const { slots, childrenByParent } = battlefieldSlots([
      card(1, 0, 0),
      card(2, -1, -1, { attachTargetCardId: 1, attachTargetPlayerId: 7 }),
      card(3, 2, 4),
    ], 7, false);
    expect(slots).toEqual([
      { row: 0, col: 0, subSlot: 0, attachedChildCount: 1 },
      { row: 2, col: 4, subSlot: 0, attachedChildCount: 0 },
    ]);
    expect(childrenByParent.get(1)?.map((c) => c.id)).toEqual(['2']);
  });

  it('keeps a card attached to another player in its own slot, and flips rows on a mirrored seat', () => {
    const { slots } = battlefieldSlots([card(4, 2, 1, { attachTargetCardId: 9, attachTargetPlayerId: 8 })], 7, true);
    expect(slots).toEqual([{ row: 0, col: 1, subSlot: 0, attachedChildCount: 0 }]);
  });
});
