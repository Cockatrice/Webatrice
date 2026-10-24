import type { ActionId } from '@app/feature-widgets/shortcuts';

export type GameMenuItemId =
  | 'nextPhase'
  | 'nextPhaseAction'
  | 'nextTurn'
  | 'reverseTurn'
  | 'rotateViewCW'
  | 'rotateViewCCW';

export type GameMenuEntry =
  | {
      kind: 'item';
      id: GameMenuItemId;
      shortcut: ActionId;
      disabled: boolean;
      onClick: () => void;
    }
  | { kind: 'divider'; id: string };

export interface GameMenuModelArgs {
  canAdvancePhase: boolean;
  canPassTurn: boolean;
  canReverseTurn: boolean;
  canRunNextPhaseAction: boolean;
  onNextPhase: () => void;
  onNextPhaseAction: () => void;
  onNextTurn: () => void;
  onReverseTurn: () => void;
  onRotateViewCW: () => void;
  onRotateViewCCW: () => void;
}

export function buildGameMenuItems(args: GameMenuModelArgs): GameMenuEntry[] {
  return [
    { kind: 'item', id: 'nextPhase', shortcut: 'game.nextPhase', disabled: !args.canAdvancePhase, onClick: args.onNextPhase },
    {
      kind: 'item',
      id: 'nextPhaseAction',
      shortcut: 'game.nextPhaseAction',
      disabled: !args.canRunNextPhaseAction,
      onClick: args.onNextPhaseAction,
    },
    { kind: 'divider', id: 'phases' },
    { kind: 'item', id: 'nextTurn', shortcut: 'game.endTurn', disabled: !args.canPassTurn, onClick: args.onNextTurn },
    { kind: 'item', id: 'reverseTurn', shortcut: 'game.reverseTurn', disabled: !args.canReverseTurn, onClick: args.onReverseTurn },
    { kind: 'divider', id: 'turns' },
    { kind: 'item', id: 'rotateViewCW', shortcut: 'game.rotateViewCW', disabled: false, onClick: args.onRotateViewCW },
    { kind: 'item', id: 'rotateViewCCW', shortcut: 'game.rotateViewCCW', disabled: false, onClick: args.onRotateViewCCW },
  ];
}
