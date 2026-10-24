import { renderHook } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';

import type { SeatSelection } from '../../../hooks/useSeatSelection';
import type {
  BattlefieldCardViewModel,
  PlayerCardCommands,
  PlayerCounterCommands,
  PlayerTargetCommands,
  PlayerZoneCommands,
} from './playerBoard.types';
import { useBattlefieldCardOps, type UseBattlefieldCardOpsArgs } from './useBattlefieldCardOps';

const bf = (id: string, extra: Partial<BattlefieldCardViewModel> = {}): BattlefieldCardViewModel => ({
  id,
  name: `Card ${id}`,
  scryfallId: `p${id}`,
  slot: { row: 0, col: Number(id) || 0 },
  subSlot: 0,
  tapped: false,
  ...extra,
});

const BOARD = [
  bf('10', { pt: '3/3', tapped: true, annotation: 'big', counters: [{ id: 1, value: 4 }] }),
  bf('11', { faceDown: true }),
  bf('12', { slot: { row: 2, col: 10 }, doesntUntap: true }),
];

function ports<T extends object>(): T {
  const spies = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return new Proxy({} as T, {
    get: (_target, key) => {
      if (!spies.has(key)) {
        spies.set(key, vi.fn());
      }
      return spies.get(key);
    },
  });
}

const battlefield = (...ids: string[]): SeatSelection => ({ zone: 'battlefield', ids: new Set(ids) });

function setup(args: Partial<UseBattlefieldCardOpsArgs> = {}) {
  const props: UseBattlefieldCardOpsArgs = {
    cards: BOARD,
    selection: battlefield('10', '11'),
    setSelection: vi.fn(),
    cardMetaByName: new Map([['Card 11', { typeLine: 'Creature', pt: '2/2' }]]),
    tokenMetaByName: new Map(),
    deckCount: 33,
    lifeControl: { value: 20, onDelta: vi.fn(), onSet: vi.fn() },
    cardCommands: ports<PlayerCardCommands>(),
    counterCommands: ports<PlayerCounterCommands>(),
    targetCommands: ports<PlayerTargetCommands>(),
    zoneCommands: ports<PlayerZoneCommands>(),
    prompts: {
      openAnnotationPrompt: vi.fn(),
      openPTPrompt: vi.fn(),
      openCardCounterPrompt: vi.fn(),
      openMoveXFromTopPrompt: vi.fn(),
      openTokenCountPrompt: vi.fn(),
    },
    setLastToken: vi.fn(),
    startAttach: vi.fn(),
    startArrow: vi.fn(),
    ...args,
  };
  const { result } = renderHook(() => useBattlefieldCardOps(props));
  return { ops: result.current, props };
}

describe('useBattlefieldCardOps', () => {
  it('targets the selection from a selected card, or the clicked card alone', () => {
    const { ops, props } = setup();
    ops.forCard('11')!.move({ zone: ZoneName.GRAVE });
    ops.forCard('12')!.move({ zone: ZoneName.DECK, reversed: true });
    expect(vi.mocked(props.zoneCommands.moveCards).mock.calls).toEqual([
      [ZoneName.TABLE, [10, 11], { zone: ZoneName.GRAVE, reversed: false }],
      [ZoneName.TABLE, [12], { zone: ZoneName.DECK, reversed: true }],
    ]);
    expect(ops.forCard('99')).toBeNull();
  });

  it('flips each target\'s tapped state, whichever card the action starts from', () => {
    const { ops, props } = setup();
    ops.forCard('11')!.toggleTapped();
    ops.forSelection()!.toggleTapped();
    ops.forCard('12')!.toggleTapped();
    expect(vi.mocked(props.cardCommands.setTapped).mock.calls).toEqual([
      [[11], true], [[10], false],
      [[11], true], [[10], false],
      [[12], true],
    ]);
  });

  it('drives the other toggles from the clicked card, or from the first selected card for a shortcut', () => {
    const { ops, props } = setup();
    ops.forCard('11')!.toggleFaceDown();
    ops.forSelection()!.toggleFaceDown();
    ops.forCard('12')!.toggleDoesntUntap();
    expect(vi.mocked(props.cardCommands.flip).mock.calls).toEqual([[10, false], [11, false], [10, true], [11, true]]);
    expect(vi.mocked(props.cardCommands.setDoesntUntap).mock.calls).toEqual([[12, false]]);
  });

  it('has no shortcut target without a battlefield selection', () => {
    expect(setup({ selection: null }).ops.forSelection()).toBeNull();
    expect(setup({ selection: { zone: 'hand', ids: new Set(['10']) } }).ops.forSelection()).toBeNull();
  });

  it('sends one batch for P/T and counter changes, skipping empty ones', () => {
    const { ops, props } = setup();
    const selected = ops.forSelection()!;
    selected.changePT(1, 1);
    selected.resetPT();
    selected.stepCounter(1, -1);
    ops.forCard('12')!.stepCounter(1, -1);
    expect(vi.mocked(props.cardCommands.setPT).mock.calls).toEqual([
      [[{ cardId: 10, pt: '4/4' }, { cardId: 11, pt: '3/3' }]],
      [[{ cardId: 10, pt: '' }]],
    ]);
    expect(vi.mocked(props.counterCommands.setCardCounters).mock.calls).toEqual([[[{ cardId: 10, counterId: 1, value: 3 }]]]);
  });

  it('peeks only at face-down targets, and only where the seat can peek', () => {
    const { ops, props } = setup();
    ops.forSelection()!.peek();
    ops.forCard('12')!.peek();
    expect(vi.mocked(props.cardCommands.peek!).mock.calls).toEqual([[[11]]]);

    const noPeek = { ...ports<PlayerCardCommands>(), peek: undefined };
    expect(() => setup({ cardCommands: noPeek }).ops.forSelection()!.peek()).not.toThrow();
  });

  it('opens the prompts on a snapshot of the targets, prefilled from the anchor', () => {
    const { ops, props } = setup();
    const selected = ops.forSelection()!;
    selected.promptPT();
    selected.promptAnnotation();
    selected.promptCounter(1);
    ops.forCard('11')!.promptPT();
    ops.forCard('11')!.promptMoveXFromTop();
    expect(vi.mocked(props.prompts.openPTPrompt).mock.calls).toEqual([
      [{ targetIds: [10, 11], cardName: 'Card 10', current: '3/3' }],
      [{ targetIds: [10, 11], cardName: 'Card 11', current: '2/2' }],
    ]);
    expect(props.prompts.openAnnotationPrompt).toHaveBeenCalledWith({ targetIds: [10, 11], cardName: 'Card 10', current: 'big' });
    expect(props.prompts.openCardCounterPrompt).toHaveBeenCalledWith({
      targetIds: [10, 11], cardName: 'Card 10', counterId: 1, currentValue: 4,
    });
    expect(props.prompts.openMoveXFromTopPrompt).toHaveBeenCalledWith({ cardIds: [11], cardName: 'Card 11', deckSize: 33 });
  });

  it('starts an attach from every target with the anchor first, and an arrow from the anchor', () => {
    const { ops, props } = setup();
    ops.forCard('11')!.attach();
    ops.forSelection()!.drawArrow();
    expect(props.startAttach).toHaveBeenCalledWith([11, 10], 'Card 11');
    expect(props.startArrow).toHaveBeenCalledWith(10, 'Card 10');

    const optimistic = setup({ cards: [bf('mock-1')], selection: null });
    optimistic.ops.forCard('mock-1')!.attach();
    optimistic.ops.forCard('mock-1')!.drawArrow();
    expect(optimistic.props.startAttach).not.toHaveBeenCalled();
    expect(optimistic.props.startArrow).not.toHaveBeenCalled();
  });

  it('anchors a shortcut attach on the first selected card with a server id', () => {
    const { ops, props } = setup({ cards: [bf('mock-1'), ...BOARD], selection: battlefield('mock-1', '11', '12') });
    ops.forSelection()!.attach();
    expect(props.startAttach).toHaveBeenCalledWith([11, 12], 'Card 11');
  });

  it('unattaches, clones and lowers life over every target', () => {
    const { ops, props } = setup();
    const selected = ops.forSelection()!;
    selected.unattach();
    selected.clone();
    selected.reduceLifeByPower();
    expect(vi.mocked(props.targetCommands.unattach).mock.calls).toEqual([[10], [11]]);
    expect(vi.mocked(props.cardCommands.clone).mock.calls.map(([source]) => source.name)).toEqual(['Card 10', 'Card 11']);
    expect(props.lifeControl!.onDelta).toHaveBeenCalledWith(-3);
  });

  it('selects all, a row or a column of the battlefield', () => {
    const { ops, props } = setup();
    ops.selectAll();
    ops.forCard('10')!.selectRow();
    ops.forCard('12')!.selectColumn();
    expect(vi.mocked(props.setSelection).mock.calls).toEqual([
      [battlefield('10', '11', '12')],
      [battlefield('10', '11')],
      [battlefield('10', '12')],
    ]);
  });

  it('increments every existing counter on the selection, or on the whole battlefield', () => {
    const all = setup({ selection: null });
    all.ops.incrementAllCounters();
    expect(all.props.counterCommands.setCardCounters).toHaveBeenCalledWith([{ cardId: 10, counterId: 1, value: 5 }]);

    const some = setup({ selection: battlefield('11') });
    some.ops.incrementAllCounters();
    expect(some.props.counterCommands.setCardCounters).not.toHaveBeenCalled();
  });

  it('creates the anchor\'s related tokens, as desktop\'s create-all does', () => {
    const { ops, props } = setup({
      cardMetaByName: new Map([['Card 10', {
        typeLine: 'Creature',
        related: [
          { name: 'Soldier', count: '2', origin: 'related' },
          { name: 'Treasure', count: 'x', origin: 'related' },
          { name: 'Equipment', attach: 'attach', origin: 'related' },
        ],
      }]]),
    });
    ops.forSelection()!.createRelatedTokens();
    expect(vi.mocked(props.cardCommands.createToken).mock.calls.map(([r]) => r.name)).toEqual(['Soldier', 'Soldier']);
    expect(props.prompts.openTokenCountPrompt).not.toHaveBeenCalled();
    expect(props.setLastToken).toHaveBeenCalledWith(expect.objectContaining({ name: 'Soldier' }));
  });

  it('asks for the count of the one related token create-all runs when it is "x"', () => {
    const { ops, props } = setup({
      cardMetaByName: new Map([['Card 10', {
        typeLine: 'Creature',
        related: [
          { name: 'Soldier', count: '2', exclude: 'exclude', origin: 'related' },
          { name: 'Treasure', count: 'x=2', origin: 'related' },
        ],
      }]]),
    });
    ops.forSelection()!.createRelatedTokens();
    expect(props.cardCommands.createToken).not.toHaveBeenCalled();
    expect(props.prompts.openTokenCountPrompt).toHaveBeenCalledWith({
      request: expect.objectContaining({ name: 'Treasure' }),
      initial: 2,
    });
    expect(props.setLastToken).toHaveBeenCalledWith(expect.objectContaining({ name: 'Treasure' }));
  });

  it('remembers no token after create-all runs only a transform', () => {
    const faces = [{ name: 'Card 10' }, { name: 'Back' }];
    const { ops, props } = setup({ cardMetaByName: new Map([['Card 10', { typeLine: 'Creature', layout: 'transform', faces }]]) });
    ops.forSelection()!.createRelatedTokens();
    expect(props.cardCommands.createToken).toHaveBeenCalledWith(expect.objectContaining({ name: 'Back', targetMode: 'transform_into' }));
    expect(props.setLastToken).not.toHaveBeenCalled();
  });
});
