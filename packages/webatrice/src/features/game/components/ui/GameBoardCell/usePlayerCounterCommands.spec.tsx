import { act } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { makeCard } from '@cockatrice/datatrice/testing';
import { LIFE_COUNTER_ID, renderSeatHook, type SeatGameSpec } from '../../../__test-utils__/seatFixtures';
import { usePlayerCounterCommands } from './usePlayerCounterCommands';

const OGRE = makeCard({
  id: 11,
  name: 'Ogre',
  x: 0,
  y: 0,
  counterList: [{ id: 0, value: 2 }, { id: 3, value: 1 }],
});

const SPEC: SeatGameSpec = { localPlayerId: 1, seats: [{ playerId: 1, table: [OGRE], life: 20 }] };

function renderCounters() {
  const utils = renderSeatHook(() => usePlayerCounterCommands(1), SPEC);
  const player = () => utils.store.getState().games.games[1].players[1];
  const counters = () => player().zones[ZoneName.TABLE].byId[11].counterList.map((c) => [c.id, c.value]);
  return { ...utils, player, counters, commands: () => utils.result()! };
}

describe('usePlayerCounterCommands', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies a delta from the current store value and rolls back to it', () => {
    const { commands, player, game } = renderCounters();
    act(() => commands().increment(LIFE_COUNTER_ID, -5));
    act(() => commands().increment(LIFE_COUNTER_ID, 2));
    expect(player().counters[LIFE_COUNTER_ID].count).toBe(17);

    act(() => vi.mocked(game.incCounter).mock.calls[1][2]!.onError!(1, {} as never));
    expect(player().counters[LIFE_COUNTER_ID].count).toBe(15);
  });

  it('sends a batch as one command container and skips an empty one', () => {
    const { commands, game } = renderCounters();
    commands().setCardCounters([]);
    commands().setCardCounters([{ cardId: 11, counterId: 0, value: 3 }]);
    expect(game.bulkSetCardCounterEntries).toHaveBeenCalledTimes(1);
    expect(game.bulkSetCardCounterEntries).toHaveBeenCalledWith(1, [
      { ownerPlayerId: 1, zone: ZoneName.TABLE, cardId: 11, counterId: 0, counterValue: 3 },
    ]);
  });
});
