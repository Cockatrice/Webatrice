import { Enriched } from '../../types';

import { Selectors } from './game.selectors';
import { makeGameEntry, makePlayerEntry, makeState,
  makeZoneEntry, makeCard, makeCounter, makeArrow,
} from '../../testing/fixtures/games';
import { GamesState } from './game.interfaces';

function rootState(games: GamesState) {
  return { games };
}

describe('Selectors', () => {
  it('getGames → returns the games map', () => {
    const state = makeState();
    expect(Selectors.getGames(rootState(state))).toBe(state.games);
  });

  it('getGame → returns the game entry for a given gameId', () => {
    const state = makeState();
    expect(Selectors.getGame(rootState(state), 1)).toBe(state.games[1]);
  });

  it('getGame → returns undefined for unknown gameId', () => {
    const state = makeState();
    expect(Selectors.getGame(rootState(state), 999)).toBeUndefined();
  });

  it('getPlayers → returns players map for a game', () => {
    const state = makeState();
    expect(Selectors.getPlayers(rootState(state), 1)).toBe(state.games[1].players);
  });

  it('getPlayers → returns undefined for unknown gameId', () => {
    const state = makeState();
    expect(Selectors.getPlayers(rootState(state), 999)).toBeUndefined();
  });

  it('getPlayer → returns a specific player', () => {
    const state = makeState();
    expect(Selectors.getPlayer(rootState(state), 1, 1)).toBe(state.games[1].players[1]);
  });

  it('getPlayer → returns undefined for unknown gameId', () => {
    const state = makeState();
    expect(Selectors.getPlayer(rootState(state), 999, 1)).toBeUndefined();
  });

  it('getLocalPlayerId → returns undefined for unknown gameId', () => {
    const state = makeState();
    expect(Selectors.getLocalPlayerId(rootState(state), 999)).toBeUndefined();
  });

  it('getLocalPlayerId → returns localPlayerId from game', () => {
    const state = makeState({ games: { 1: makeGameEntry({ localPlayerId: 42 }) } });
    expect(Selectors.getLocalPlayerId(rootState(state), 1)).toBe(42);
  });

  it('getLocalPlayer → returns the player matching localPlayerId', () => {
    const state = makeState({ games: { 1: makeGameEntry({ localPlayerId: 1 }) } });
    const result = Selectors.getLocalPlayer(rootState(state), 1);
    expect(result).toBe(state.games[1].players[1]);
  });

  it('getLocalPlayer → returns undefined when game is not found', () => {
    const state = makeState();
    expect(Selectors.getLocalPlayer(rootState(state), 999)).toBeUndefined();
  });

  it('getZones → returns zones map for a player', () => {
    const state = makeState();
    expect(Selectors.getZones(rootState(state), 1, 1)).toBe(state.games[1].players[1].zones);
  });

  it('getZones → returns undefined for unknown gameId', () => {
    const state = makeState();
    expect(Selectors.getZones(rootState(state), 999, 1)).toBeUndefined();
  });

  it('getZone → returns a specific zone', () => {
    const state = makeState();
    expect(Selectors.getZone(rootState(state), 1, 1, 'hand')).toBe(state.games[1].players[1].zones['hand']);
  });

  it('getZone → returns undefined for unknown gameId', () => {
    const state = makeState();
    expect(Selectors.getZone(rootState(state), 999, 1, 'hand')).toBeUndefined();
  });

  it('getCards → caches and returns the same array reference for repeated calls', () => {
    const card = makeCard();
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: { 1: makePlayerEntry({ zones: { hand: makeZoneEntry({ name: 'hand', cards: [card] }) } }) },
        }),
      },
    });
    const a = Selectors.getCards(rootState(state), 1, 1, 'hand');
    const b = Selectors.getCards(rootState(state), 1, 1, 'hand');
    expect(a).toBe(b);
  });

  it('getCards → returns cards array for a zone', () => {
    const card = makeCard();
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: {
            1: makePlayerEntry({
              zones: { hand: makeZoneEntry({ name: 'hand', cards: [card] }) },
            }),
          },
        }),
      },
    });
    expect(Selectors.getCards(rootState(state), 1, 1, 'hand')).toEqual([card]);
  });

  it('getCards → returns [] when zone not found', () => {
    const state = makeState();
    expect(Selectors.getCards(rootState(state), 1, 1, 'nonexistent')).toEqual([]);
  });

  it('getRevealedCards → returns the zone.revealedCards snapshot', () => {
    const cards = [makeCard({ id: 0 }), makeCard({ id: 1 })];
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: { 1: makePlayerEntry({ zones: { deck: makeZoneEntry({ name: 'deck', cards: [] }) } }) },
        }),
      },
    });
    state.games[1].players[1].zones['deck'].revealedCards = cards;
    expect(Selectors.getRevealedCards(rootState(state), 1, 1, 'deck')).toBe(cards);
  });

  it('getRevealedCards → returns [] when no revealed snapshot is present', () => {
    const state = makeState({
      games: {
        1: makeGameEntry({
          players: { 1: makePlayerEntry({ zones: { deck: makeZoneEntry({ name: 'deck', cards: [] }) } }) },
        }),
      },
    });
    expect(Selectors.getRevealedCards(rootState(state), 1, 1, 'deck')).toEqual([]);
  });

  it('getCounters → returns counters map for a player', () => {
    const counter = makeCounter({ id: 2 });
    const state = makeState({
      games: { 1: makeGameEntry({ players: { 1: makePlayerEntry({ counters: { 2: counter } }) } }) },
    });
    expect(Selectors.getCounters(rootState(state), 1, 1)).toEqual({ 2: counter });
  });

  it('getCounters → returns the empty fallback object for an unknown gameId', () => {
    const state = makeState();
    expect(Selectors.getCounters(rootState(state), 999, 1)).toEqual({});
  });

  it('getArrows → returns arrows map for a player', () => {
    const arrow = makeArrow({ id: 3 });
    const state = makeState({
      games: { 1: makeGameEntry({ players: { 1: makePlayerEntry({ arrows: { 3: arrow } }) } }) },
    });
    expect(Selectors.getArrows(rootState(state), 1, 1)).toEqual({ 3: arrow });
  });

  it('getArrows → returns the empty fallback object for an unknown gameId', () => {
    const state = makeState();
    expect(Selectors.getArrows(rootState(state), 999, 1)).toEqual({});
  });

  it('getActivePlayerId → returns activePlayerId from game', () => {
    const state = makeState({ games: { 1: makeGameEntry({ activePlayerId: 7 }) } });
    expect(Selectors.getActivePlayerId(rootState(state), 1)).toBe(7);
  });

  it('getActivePlayerId → returns undefined for unknown gameId', () => {
    const state = makeState();
    expect(Selectors.getActivePlayerId(rootState(state), 999)).toBeUndefined();
  });

  it('getActivePhase → returns activePhase from game', () => {
    const state = makeState({ games: { 1: makeGameEntry({ activePhase: 3 }) } });
    expect(Selectors.getActivePhase(rootState(state), 1)).toBe(3);
  });

  it('getActivePhase → returns undefined for unknown gameId', () => {
    const state = makeState();
    expect(Selectors.getActivePhase(rootState(state), 999)).toBeUndefined();
  });

  it('getHostId → returns hostId from game', () => {
    const state = makeState({ games: { 1: makeGameEntry({ hostId: 7 }) } });
    expect(Selectors.getHostId(rootState(state), 1)).toBe(7);
  });

  it('getHostId → returns undefined for unknown gameId', () => {
    const state = makeState();
    expect(Selectors.getHostId(rootState(state), 999)).toBeUndefined();
  });

  it('getSecondsElapsed → returns secondsElapsed from game', () => {
    const state = makeState({ games: { 1: makeGameEntry({ secondsElapsed: 314 }) } });
    expect(Selectors.getSecondsElapsed(rootState(state), 1)).toBe(314);
  });

  it('getSecondsElapsed → returns undefined for unknown gameId', () => {
    const state = makeState();
    expect(Selectors.getSecondsElapsed(rootState(state), 999)).toBeUndefined();
  });

  it('getJudge → returns judge flag from game', () => {
    const state = makeState({ games: { 1: makeGameEntry({ judge: true }) } });
    expect(Selectors.getJudge(rootState(state), 1)).toBe(true);
  });

  it('getJudge → returns false when game not found', () => {
    const state = makeState();
    expect(Selectors.getJudge(rootState(state), 999)).toBe(false);
  });

  it('getResuming → returns resuming flag from game', () => {
    const state = makeState({ games: { 1: makeGameEntry({ resuming: true }) } });
    expect(Selectors.getResuming(rootState(state), 1)).toBe(true);
  });

  it('getResuming → returns false when game not found', () => {
    const state = makeState();
    expect(Selectors.getResuming(rootState(state), 999)).toBe(false);
  });

  it('isStarted → returns true when game is started', () => {
    const state = makeState({ games: { 1: makeGameEntry({ started: true }) } });
    expect(Selectors.isStarted(rootState(state), 1)).toBe(true);
  });

  it('isStarted → returns false when game not found', () => {
    const state = makeState();
    expect(Selectors.isStarted(rootState(state), 999)).toBe(false);
  });

  it('isSpectator → returns spectator flag from game', () => {
    const state = makeState({ games: { 1: makeGameEntry({ spectator: true }) } });
    expect(Selectors.isSpectator(rootState(state), 1)).toBe(true);
  });

  it('isSpectator → returns false for unknown gameId', () => {
    const state = makeState();
    expect(Selectors.isSpectator(rootState(state), 999)).toBe(false);
  });

  it('isReversed → returns reversed flag from game', () => {
    const state = makeState({ games: { 1: makeGameEntry({ reversed: true }) } });
    expect(Selectors.isReversed(rootState(state), 1)).toBe(true);
  });

  it('isReversed → returns false for unknown gameId', () => {
    const state = makeState();
    expect(Selectors.isReversed(rootState(state), 999)).toBe(false);
  });

  it('getMessages → returns messages array from game', () => {
    const messages = [{ playerId: 1, message: 'hi', timeReceived: 100 }];
    const state = makeState({ games: { 1: makeGameEntry({ messages }) } });
    expect(Selectors.getMessages(rootState(state), 1)).toBe(messages);
  });

  it('getMessages → returns [] when game not found', () => {
    const state = makeState();
    expect(Selectors.getMessages(rootState(state), 999)).toEqual([]);
  });

  describe('getAttachmentsByParent', () => {
    function stateWithTable(cards: ReturnType<typeof makeCard>[]): GamesState {
      return makeState({
        games: {
          1: makeGameEntry({
            players: {
              1: makePlayerEntry({
                zones: {
                  [Enriched.ZoneName.TABLE]: makeZoneEntry({
                    name: Enriched.ZoneName.TABLE,
                    withCoords: true,
                    cardCount: cards.length,
                    cards,
                  }),
                },
              }),
            },
          }),
        },
      });
    }

    function stateWithTwoTables(
      player1Cards: ReturnType<typeof makeCard>[],
      player2Cards: ReturnType<typeof makeCard>[],
    ): GamesState {
      return makeState({
        games: {
          1: makeGameEntry({
            localPlayerId: 1,
            players: {
              1: makePlayerEntry({
                zones: {
                  [Enriched.ZoneName.TABLE]: makeZoneEntry({
                    name: Enriched.ZoneName.TABLE,
                    withCoords: true,
                    cardCount: player1Cards.length,
                    cards: player1Cards,
                  }),
                },
              }),
              2: makePlayerEntry({
                zones: {
                  [Enriched.ZoneName.TABLE]: makeZoneEntry({
                    name: Enriched.ZoneName.TABLE,
                    withCoords: true,
                    cardCount: player2Cards.length,
                    cards: player2Cards,
                  }),
                },
              }),
            },
          }),
        },
      });
    }

    it('returns an empty map when the game is missing', () => {
      const state = makeState({ games: {} });
      const result = Selectors.getAttachmentsByParent(rootState(state), 1, 1);
      expect(result.size).toBe(0);
    });

    it('skips players that have no battlefield zone', () => {
      // makePlayerEntry defaults to hand/deck zones only — no TABLE zone.
      const state = makeState({
        games: {
          1: makeGameEntry({
            players: {
              1: makePlayerEntry(),
              2: makePlayerEntry(),
            },
          }),
        },
      });
      const result = Selectors.getAttachmentsByParent(rootState(state), 1, 1);
      expect(result.size).toBe(0);
    });

    it('returns an empty map when no cards are attached', () => {
      const cards = [
        makeCard({ id: 1, name: 'Creature A' }),
        makeCard({ id: 2, name: 'Creature B' }),
      ];
      const state = stateWithTable(cards);
      const result = Selectors.getAttachmentsByParent(rootState(state), 1, 1);
      expect(result.size).toBe(0);
    });

    it('buckets a single attached child under its parent id', () => {
      const cards = [
        makeCard({ id: 10, name: 'Creature' }),
        makeCard({
          id: 11, name: 'Aura',
          attachPlayerId: 1, attachZone: Enriched.ZoneName.TABLE, attachCardId: 10,
        }),
      ];
      const state = stateWithTable(cards);
      const result = Selectors.getAttachmentsByParent(rootState(state), 1, 1);
      expect(result.size).toBe(1);
      expect(result.get(10)?.map((e) => e.card.name)).toEqual(['Aura']);
      expect(result.get(10)?.[0].ownerPlayerId).toBe(1);
    });

    it('keeps multiple children in zone-insertion order (matches Cockatrice attachedCards iterator)', () => {
      // Cards are listed in the fixture in zone.order: [creature(5), 30, 10, 20].
      // Cockatrice paints attached cards in the order they were appended to
      // the parent's attachedCards list (table_zone.cpp:172). zone.order is a
      // stable proxy for that — first card to enter the zone is iterated first.
      const cards = [
        makeCard({ id: 5, name: 'Creature' }),
        makeCard({
          id: 30, name: 'Aura first',
          attachPlayerId: 1, attachZone: Enriched.ZoneName.TABLE, attachCardId: 5,
        }),
        makeCard({
          id: 10, name: 'Aura middle',
          attachPlayerId: 1, attachZone: Enriched.ZoneName.TABLE, attachCardId: 5,
        }),
        makeCard({
          id: 20, name: 'Aura last',
          attachPlayerId: 1, attachZone: Enriched.ZoneName.TABLE, attachCardId: 5,
        }),
      ];
      const state = stateWithTable(cards);
      const result = Selectors.getAttachmentsByParent(rootState(state), 1, 1);
      expect(result.get(5)?.map((e) => e.card.name)).toEqual([
        'Aura first',
        'Aura middle',
        'Aura last',
      ]);
    });

    it('ignores attachments pointing to a non-TABLE zone', () => {
      const cards = [
        makeCard({ id: 1, name: 'Creature' }),
        makeCard({
          id: 2, name: 'Non-table ref',
          attachPlayerId: 1, attachZone: Enriched.ZoneName.HAND, attachCardId: 1,
        }),
      ];
      const state = stateWithTable(cards);
      const result = Selectors.getAttachmentsByParent(rootState(state), 1, 1);
      expect(result.size).toBe(0);
    });

    it('returns a stable Map reference for the same state object', () => {
      const cards = [
        makeCard({ id: 1, name: 'Creature' }),
        makeCard({
          id: 2, name: 'Aura',
          attachPlayerId: 1, attachZone: Enriched.ZoneName.TABLE, attachCardId: 1,
        }),
      ];
      const state = stateWithTable(cards);
      const a = Selectors.getAttachmentsByParent(rootState(state), 1, 1);
      const b = Selectors.getAttachmentsByParent(rootState(state), 1, 1);
      expect(a).toBe(b);
    });

    describe('cross-player attach', () => {
      it('surfaces an aura in player 1\'s zone parented to player 2\'s creature under player 2', () => {
        // Mirrors Servatrice cmdAttachCard cross-player branch: the aura
        // stays in its original owner's table, only the parent pointer
        // crosses player boundaries. The renderer for player 2's
        // battlefield must still see the aura nested under their creature.
        const player1Cards = [
          makeCard({
            id: 11, name: 'Aura on enemy',
            attachPlayerId: 2, attachZone: Enriched.ZoneName.TABLE, attachCardId: 21,
          }),
        ];
        const player2Cards = [
          makeCard({ id: 21, name: 'Creature' }),
        ];
        const state = stateWithTwoTables(player1Cards, player2Cards);

        const forParent = Selectors.getAttachmentsByParent(rootState(state), 1, 2);
        expect(forParent.get(21)?.map((e) => e.card.name)).toEqual(['Aura on enemy']);
        expect(forParent.get(21)?.[0].ownerPlayerId).toBe(1);

        // The aura must NOT also appear under its own owner's parents — its
        // attachPlayerId is 2, not 1.
        const forOwner = Selectors.getAttachmentsByParent(rootState(state), 1, 1);
        expect(forOwner.size).toBe(0);
      });

      it('groups children from multiple owners under a shared parent in player-id order', () => {
        const player1Cards = [
          makeCard({ id: 11, name: 'P1 creature' }),
          makeCard({
            id: 12, name: 'P1 aura',
            attachPlayerId: 2, attachZone: Enriched.ZoneName.TABLE, attachCardId: 21,
          }),
        ];
        const player2Cards = [
          makeCard({ id: 21, name: 'P2 creature' }),
          makeCard({
            id: 22, name: 'P2 aura',
            attachPlayerId: 2, attachZone: Enriched.ZoneName.TABLE, attachCardId: 21,
          }),
        ];
        const state = stateWithTwoTables(player1Cards, player2Cards);
        const forP2 = Selectors.getAttachmentsByParent(rootState(state), 1, 2);
        // Player 1 iterated before player 2 → P1's aura first, P2's aura
        // second.
        expect(forP2.get(21)?.map((e) => `${e.ownerPlayerId}:${e.card.name}`)).toEqual([
          '1:P1 aura',
          '2:P2 aura',
        ]);
      });
    });
  });

  it('getActiveGameIds → returns numeric array of gameIds', () => {
    const state = makeState({
      games: {
        1: makeGameEntry(),
        2: makeGameEntry(),
      },
    });
    const ids = Selectors.getActiveGameIds(rootState(state));
    expect(ids).toEqual(expect.arrayContaining([1, 2]));
    expect(ids).toHaveLength(2);
  });

  it('getActiveGames → returns the full GameEntry array', () => {
    const e1 = makeGameEntry();
    const e2 = makeGameEntry();
    const state = makeState({ games: { 1: e1, 2: e2 } });
    const games = Selectors.getActiveGames(rootState(state));
    expect(games).toHaveLength(2);
    expect(games).toEqual(expect.arrayContaining([e1, e2]));
  });

  it('getActiveGames → returns empty array when no games are active', () => {
    const state = makeState({ games: {} });
    expect(Selectors.getActiveGames(rootState(state))).toHaveLength(0);
  });
});
