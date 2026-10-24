import type { ActionId } from '@app/feature-widgets/shortcuts';

export type TrayActionId = 'untapAll' | 'draw' | 'shuffle' | 'drawN' | 'rollDie' | 'createToken';

export interface TrayActionSpec {
  id: TrayActionId;
  shortcut: ActionId;
  disabled: boolean;
}

export interface TrayActionState {
  canAct: boolean;
  canRoll: boolean;
  deckCount: number;
}

const ORDER: ReadonlyArray<{ id: TrayActionId; shortcut: ActionId }> = [
  { id: 'untapAll', shortcut: 'game.untapAll' },
  { id: 'draw', shortcut: 'game.drawCard' },
  { id: 'shuffle', shortcut: 'game.shuffleLibrary' },
  { id: 'drawN', shortcut: 'game.drawMultipleCards' },
  { id: 'rollDie', shortcut: 'game.rollDice' },
  { id: 'createToken', shortcut: 'game.createToken' },
];

export function buildTrayActions({ canAct, canRoll, deckCount }: TrayActionState): TrayActionSpec[] {
  const disabledFor: Record<TrayActionId, boolean> = {
    untapAll: !canAct,
    draw: !canAct || deckCount <= 0,
    shuffle: !canAct || deckCount <= 1,
    drawN: !canAct || deckCount <= 0,
    rollDie: !canRoll,
    createToken: !canAct,
  };
  return ORDER.map(({ id, shortcut }) => ({ id, shortcut, disabled: disabledFor[id] }));
}
