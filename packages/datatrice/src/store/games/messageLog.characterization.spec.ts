import { create } from '@bufbuild/protobuf';
import { Event_SetCounterSchema } from '@cockatrice/sockatrice/generated';
import { makeGameEntry, makePlayerEntry, makePlayerProperties } from '../../testing/fixtures/games';
import { formatActivePhaseSet, formatCardsDrawn, formatCounterSet, formatLeaveMessage } from './messageLog';

describe('game-log compatibility before structured entries', () => {
  const game = makeGameEntry({
    players: {
      1: makePlayerEntry({ properties: makePlayerProperties({ playerId: 1, userInfo: { name: 'Alice' } }) }),
    },
  });

  it('preserves life text and styled numbers, including a zero delta', () => {
    const entry = formatCounterSet(game, 1, create(Event_SetCounterSchema, { counterId: 0, value: 20 }), 'life', 20);
    expect(entry.text).toBe('Alice sets counter Life to 20 (0).');
    expect(entry.segments).toEqual([
      { text: 'Alice', kind: 'player' },
      { text: ' sets counter Life to ', kind: 'plain' },
      { text: '20', kind: 'number' },
      { text: ' (', kind: 'plain' },
      { text: '0', kind: 'number' },
      { text: ').', kind: 'plain' },
    ]);
  });

  it('preserves system and absent-player display names', () => {
    expect(formatCardsDrawn(game, -1, 1).text).toBe('The server draws 1 card.');
    expect(formatCardsDrawn(game, 42, 2).text).toBe('Player 42 draws 2 cards.');
  });

  it('retains fallback phase and leave-reason wording', () => {
    expect(formatActivePhaseSet(99).text).toBe('It is now the phase 99.');
    expect(formatLeaveMessage('Alice', 99).text).toBe('Alice has left the game (reason unknown).');
  });
});
