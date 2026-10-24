import { buildGameMenuItems, type GameMenuModelArgs } from './gameMenu.model';

const args = (overrides: Partial<GameMenuModelArgs> = {}): GameMenuModelArgs => ({
  canAdvancePhase: true,
  canPassTurn: true,
  canReverseTurn: true,
  canRunNextPhaseAction: true,
  onNextPhase: vi.fn(),
  onNextPhaseAction: vi.fn(),
  onNextTurn: vi.fn(),
  onReverseTurn: vi.fn(),
  onRotateViewCW: vi.fn(),
  onRotateViewCCW: vi.fn(),
  ...overrides,
});

const summary = (a: GameMenuModelArgs) =>
  buildGameMenuItems(a).map((e) => (e.kind === 'item' ? [e.id, e.shortcut, e.disabled] : '---'));

describe('buildGameMenuItems', () => {
  it('follows desktop order with each item on its own shortcut', () => {
    expect(summary(args())).toEqual([
      ['nextPhase', 'game.nextPhase', false],
      ['nextPhaseAction', 'game.nextPhaseAction', false],
      '---',
      ['nextTurn', 'game.endTurn', false],
      ['reverseTurn', 'game.reverseTurn', false],
      '---',
      ['rotateViewCW', 'game.rotateViewCW', false],
      ['rotateViewCCW', 'game.rotateViewCCW', false],
    ]);
  });

  it('gates phase items on the phase gate and turn items on the turn gate', () => {
    expect(summary(args({ canAdvancePhase: false, canRunNextPhaseAction: false })).slice(0, 5)).toEqual([
      ['nextPhase', 'game.nextPhase', true],
      ['nextPhaseAction', 'game.nextPhaseAction', true],
      '---',
      ['nextTurn', 'game.endTurn', false],
      ['reverseTurn', 'game.reverseTurn', false],
    ]);
    expect(summary(args({ canPassTurn: false, canReverseTurn: false })).slice(3, 5)).toEqual([
      ['nextTurn', 'game.endTurn', true],
      ['reverseTurn', 'game.reverseTurn', true],
    ]);
  });

  it('keeps Reverse turn order for a conceded judge, who may not pass the turn', () => {
    expect(summary(args({ canPassTurn: false, canReverseTurn: true })).slice(3, 5)).toEqual([
      ['nextTurn', 'game.endTurn', true],
      ['reverseTurn', 'game.reverseTurn', false],
    ]);
  });

  it('keeps the local view rotation available with every gate closed', () => {
    const closed = args({ canAdvancePhase: false, canPassTurn: false, canReverseTurn: false, canRunNextPhaseAction: false });
    expect(summary(closed).slice(-2)).toEqual([
      ['rotateViewCW', 'game.rotateViewCW', false],
      ['rotateViewCCW', 'game.rotateViewCCW', false],
    ]);
  });
});
