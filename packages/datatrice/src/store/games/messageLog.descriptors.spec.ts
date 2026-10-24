import { create } from '@bufbuild/protobuf';
import { Event_MoveCardSchema, Event_RollDieSchema, Event_SetCounterSchema } from '@cockatrice/sockatrice/generated';
import { makeGameEntry, makePlayerEntry, makePlayerProperties, makeZoneEntry } from '../../testing/fixtures/games';
import {
  classifyLogTone, formatActivePhaseSet, formatCardsDrawn, formatCardMoved, formatCounterSet,
  formatDieRolled, formatLeaveMessage, formatPropertyDiff, logPlayer, logTone,
} from './messageLog';
import { Actions } from './game.actions';
import { gamesReducer } from './game.reducer';
import { makeState } from '../../testing/fixtures/games';

function fixture() {
  return makeGameEntry({
    players: {
      1: makePlayerEntry({
        properties: makePlayerProperties({ playerId: 1, userInfo: { name: 'Alice' } }),
        zones: { deck: makeZoneEntry({ name: 'deck', cardCount: 9 }) },
      }),
    },
  });
}

describe('structured log descriptors', () => {
  it('keeps phase ids and raw counter names instead of English labels', () => {
    expect(formatActivePhaseSet(3)).toMatchObject({ kind: 'activePhaseSet', params: { phase: 3 } });
    expect(formatCounterSet(fixture(), 1, create(Event_SetCounterSchema, { counterId: 4, value: 19 }), 'life', 20))
      .toMatchObject({
        kind: 'counterSet', params: { actor: { id: 1, name: 'Alice' }, counterId: 4, counterName: 'life', value: 19, previousValue: 20 },
      });
  });

  it('captures missing player identity as data for host-owned fallbacks', () => {
    expect(formatCardsDrawn(fixture(), 9, 1)).toMatchObject({
      kind: 'cardsDrawn', params: { actor: { id: 9, name: undefined }, count: 1 },
    });
    expect(formatCardsDrawn(fixture(), -1, 1)).toMatchObject({
      params: { actor: { id: -1, name: undefined } },
    });
  });

  it.each([undefined, '', '  '])('preserves an unnamed departure without inventing a name: %j', (name) => {
    const entry = formatLeaveMessage({ id: 1, name }, 3);
    expect(entry).toMatchObject({ kind: 'playerLeft', params: { actor: { id: 1, name: name ?? '' }, reason: 3 } });
    expect(entry.text).toBe(`${name ?? ''} has left the game (player left the game).`);
  });

  it('captures a departing name without retaining the mutable player graph', () => {
    const game = fixture();
    const entry = formatLeaveMessage(logPlayer(game, 1), 2);
    delete game.players[1];
    expect(entry).toMatchObject({ kind: 'playerLeft', params: { actor: { id: 1, name: 'Alice' }, reason: 2 } });
    expect(entry.text).toBe('Alice has left the game (kicked by game host or moderator).');
  });

  it('captures source and destination positions and counts before later moves change them', () => {
    const game = fixture();
    const entry = formatCardMoved(game, 1, create(Event_MoveCardSchema, {
      startPlayerId: 1, targetPlayerId: 1, startZone: 'deck', targetZone: 'hand', position: 9, x: -1,
    }), { resolvedCardName: '' });
    game.players[1].zones.deck.cardCount = 2;
    expect(entry).toMatchObject({
      kind: 'cardMoved', params: {
        sourceOwner: { id: 1, name: 'Alice' }, targetOwner: { id: 1, name: 'Alice' },
        startZone: 'deck', targetZone: 'hand', position: 9, targetPosition: -1, sourceCount: 9, cardName: '',
      },
    });
    expect(entry?.text).toBe('Alice moves the bottom card of their library to their hand.');
  });

  it('copies dice results rather than storing the protobuf array', () => {
    const data = create(Event_RollDieSchema, { sides: 2, values: [1, 2] });
    const entry = formatDieRolled(fixture(), 1, data);
    data.values.push(1);
    expect(entry).toMatchObject({ kind: 'dieRolled', params: { sides: 2, rolls: [1, 2] } });
  });

  it('preserves the ordered property events as distinct kinds', () => {
    expect(formatPropertyDiff(fixture(), 1, {
      conceded: true, unconceded: true, ready: true, unready: true,
      sideboardLocked: true, sideboardUnlocked: true, deckLoaded: { hash: 'abc' },
    }).map(({ kind }) => kind)).toEqual([
      'playerConceded', 'playerUnconceded', 'playerReady', 'playerUnready', 'sideboardLocked', 'sideboardUnlocked', 'deckLoaded',
    ]);
  });

  it('classifies structured entries by kind even if the deprecated text is translated', () => {
    const entry = formatActivePhaseSet(3);
    expect(classifyLogTone({ ...entry, text: 'Fase principal' })).toBe('phase');
    expect(logTone('counterSet')).toBe('action');
    expect(logTone('activePlayerSet')).toBe('turn');
    expect(logTone('playerLeft')).toBe('system');
  });

  it('keeps descriptor-free legacy entries accepted at the append boundary', () => {
    const entry = { text: 'legacy event', segments: [{ text: 'legacy event', kind: 'plain' as const }] };
    const result = gamesReducer(makeState({ games: { 1: fixture() } }), Actions.gameMessageAppended({
      gameId: 1, playerId: 1, message: entry, timeReceived: 1234,
    }));
    expect(result.games[1].messages[0]).toMatchObject({ message: entry.text, segments: entry.segments, timeReceived: 1234 });
    expect(result.games[1].messages[0].descriptor).toBeUndefined();
  });
});
