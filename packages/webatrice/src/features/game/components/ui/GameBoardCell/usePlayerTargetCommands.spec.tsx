import { act } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { Event_CreateArrowSchema } from '@cockatrice/sockatrice/generated';
import { ZoneName } from '@cockatrice/sockatrice';
import { makeArrow } from '@cockatrice/datatrice/testing';
import { games, Phase } from '@cockatrice/datatrice';
import { ArrowColor } from '@app/types';
import { makeCard } from '@cockatrice/datatrice/testing';
import { renderSeatHook, type SeatGameSpec } from '../../../__test-utils__/seatFixtures';
import { PREFERENCE_DEFAULTS } from '@app/types';
import { usePreference } from '../../../../../hooks/useSettings';
import { usePlayerTargetCommands, useTargetCommandsFor } from './usePlayerTargetCommands';

vi.mock('../../../../../hooks/useSettings');

vi.mock('../../../../../services/dexie/DexieDTOs/CardDTO', () => ({
  CardDTO: { get: vi.fn(async () => ({ tablerow: { value: '1' } })) },
}));

const preferring = (overrides: Partial<typeof PREFERENCE_DEFAULTS>) => vi.mocked(usePreference).mockImplementation(
  ((key: keyof typeof PREFERENCE_DEFAULTS) => ({ ...PREFERENCE_DEFAULTS, ...overrides })[key]) as typeof usePreference,
);

afterEach(() => {
  preferring({});
});

const SPEC: SeatGameSpec = { localPlayerId: 1, seats: [{ playerId: 1 }, { playerId: 2 }] };

function renderTargets() {
  const utils = renderSeatHook(() => usePlayerTargetCommands(1), SPEC, (state) => {
    state.games!.games![1]!.players![1]!.arrows = { 5: makeArrow({ id: 5 }) };
    state.games!.games![1]!.players![2]!.arrows = { 9: makeArrow({ id: 9 }) };
  });
  return { ...utils, commands: () => utils.result()! };
}

describe('usePlayerTargetCommands', () => {
  it('omits every target field for an unattach and for a player-targeted arrow', () => {
    const { commands, game } = renderTargets();
    commands().unattach(10);
    commands().createArrow(10, ZoneName.EXILE, { kind: 'player', playerId: 2 });

    expect(vi.mocked(game.attachCard).mock.calls[0][1]).toEqual({ startZone: ZoneName.TABLE, cardId: 10 });
    expect(vi.mocked(game.createArrow).mock.calls[0][1]).toEqual({
      startPlayerId: 1,
      startZone: ZoneName.EXILE,
      startCardId: 10,
      targetPlayerId: 2,
      arrowColor: ArrowColor.RED,
      deleteInPhase: Phase.FirstMain,
    });
  });

  it('clears only this player\'s arrows, as they are when the command runs', () => {
    const { commands, game, store } = renderTargets();
    act(() => {
      store.dispatch(games.Actions.arrowCreated({
        gameId: 1,
        playerId: 1,
        data: create(Event_CreateArrowSchema, { arrowInfo: makeArrow({ id: 6 }) }),
      }));
    });
    commands().clearOwnArrows();
    expect(vi.mocked(game.deleteArrow).mock.calls).toEqual([[1, { arrowId: 5 }], [1, { arrowId: 6 }]]);
  });
});

describe('target commands', () => {
  const card = (cardId: number) => ({ kind: 'card' as const, playerId: 2, zone: ZoneName.STACK, cardId });

  it('sends a card target\'s own zone, and the given arrow colour', () => {
    const { commands, game } = renderTargets();
    commands().createArrow(10, ZoneName.TABLE, card(21), ArrowColor.GREEN);
    expect(game.createArrow).toHaveBeenCalledWith(1, {
      startPlayerId: 1,
      startZone: ZoneName.TABLE,
      startCardId: 10,
      targetPlayerId: 2,
      targetZone: ZoneName.STACK,
      targetCardId: 21,
      arrowColor: ArrowColor.GREEN,
      deleteInPhase: Phase.FirstMain,
    });
  });

  it('wraps a judge\'s attach of another player\'s card as its owner, but never an arrow', () => {
    const { result, game } = renderSeatHook(() => useTargetCommandsFor(1), { ...SPEC, localPlayerId: 3, judge: true });
    const foreign = result()!(2);
    foreign.attach(20, { playerId: 1, cardId: 10 });
    foreign.unattach(20);
    foreign.createArrow(20, ZoneName.TABLE, { kind: 'player', playerId: 1 });
    expect(vi.mocked(game.attachCard).mock.calls.map(([, , judgeTargetId]) => judgeTargetId)).toEqual([2, 2]);
    expect(vi.mocked(game.createArrow).mock.calls[0]).toHaveLength(2);

    const own = renderSeatHook(() => useTargetCommandsFor(1), SPEC);
    own.result()!(1).attach(10, { playerId: 1, cardId: 11 });
    expect(vi.mocked(own.game.attachCard).mock.calls[0][2]).toBeUndefined();
  });

  const playThenArrow = async (playToStack: boolean) => {
    preferring({ playToStack });
    const { result, game } = renderSeatHook(
      () => useTargetCommandsFor(1),
      { localPlayerId: 1, seats: [{ playerId: 1, hand: [makeCard({ id: 30, name: 'Bear' })] }, { playerId: 2 }] },
    );
    result()!(1).playAndCreateArrow(30, { kind: 'player', playerId: 2 }, ArrowColor.YELLOW);
    result()!(1).playAndCreateArrow(99, { kind: 'player', playerId: 2 });
    await vi.waitFor(() => expect(game.createArrow).toHaveBeenCalled());
    return game;
  };

  it('plays a hand creature onto the stack with playToStack on, then draws the arrow from there', async () => {
    const game = await playThenArrow(true);
    expect(vi.mocked(game.moveCard).mock.calls).toEqual([[1, expect.objectContaining({
      startZone: ZoneName.HAND,
      cardsToMove: { card: [{ cardId: 30, faceDown: false }] },
      targetZone: ZoneName.STACK,
    }), undefined]]);
    expect(vi.mocked(game.createArrow).mock.calls).toEqual([[1, {
      startPlayerId: 1, startZone: ZoneName.STACK, startCardId: 30, targetPlayerId: 2, arrowColor: ArrowColor.YELLOW,
      deleteInPhase: Phase.FirstMain,
    }]]);
  });

  it('plays a hand creature onto the battlefield with playToStack off, then draws the arrow from there', async () => {
    const game = await playThenArrow(false);
    expect(vi.mocked(game.moveCard).mock.calls).toEqual([[1, expect.objectContaining({
      startZone: ZoneName.HAND,
      cardsToMove: { card: [{ cardId: 30, faceDown: false }] },
      targetZone: ZoneName.TABLE,
    }), undefined]]);
    expect(vi.mocked(game.createArrow).mock.calls).toEqual([[1, {
      startPlayerId: 1, startZone: ZoneName.TABLE, startCardId: 30, targetPlayerId: 2, arrowColor: ArrowColor.YELLOW,
      deleteInPhase: Phase.FirstMain,
    }]]);
  });

  it('is undefined until the game id is known', () => {
    const { result } = renderSeatHook(() => useTargetCommandsFor(undefined), SPEC);
    expect(result()).toBeUndefined();
  });
});
