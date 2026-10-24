import { ZoneName } from '@cockatrice/sockatrice';
import { create } from '@bufbuild/protobuf';
import { Event_SetCounterSchema } from '@cockatrice/sockatrice/generated';
import { act } from '@testing-library/react';
import { games } from '@cockatrice/datatrice';
import { makeCard, makePlayerProperties, makeZoneEntry } from '@cockatrice/datatrice/testing';
import { renderWithProviders } from '../../../../../__test-utils__';
import { buildSeatGameState, LIFE_COUNTER_ID, MANA_COUNTER_IDS, type SeatGameSpec } from '../../../__test-utils__/seatFixtures';
import type { BoardCell } from '../../../hooks/useGameBoardLayout';
import type { PlayerBoardModel } from '../PlayerBoard/playerBoard.types';
import { usePlayerSeatViewModel } from './usePlayerSeatViewModel';

const BOLT = makeCard({ id: 10, name: 'Bolt', providerId: 'bolt-pid', x: 4, y: 1, counterList: [] });
const OGRE = makeCard({ id: 11, name: 'Ogre', x: 0, y: 0, tapped: true, pt: '3/3', annotation: 'big' });
const SHOCK = makeCard({ id: 30, name: 'Shock', providerId: 'shock-pid' });
const DURESS = makeCard({ id: 40, name: 'Duress' });
const OPT = makeCard({ id: 41, name: 'Opt' });
const SPELL = makeCard({ id: 50, name: 'Counterspell', annotation: 'targets Bolt' });
const BEAR = makeCard({ id: 20, name: 'Bear', x: 0, y: 0 });
const AURA = makeCard({ id: 21, name: 'Pacifism', x: 3, y: 0, attachPlayerId: 1, attachZone: ZoneName.TABLE, attachCardId: 10 });
const SWORD = makeCard({ id: 12, name: 'Sword', x: 6, y: 0, attachPlayerId: 2, attachZone: ZoneName.TABLE, attachCardId: 20 });

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  activePlayerId: 2,
  seats: [
    { playerId: 1, table: [BOLT, OGRE, SWORD], hand: [SHOCK], grave: [DURESS, OPT], stack: [SPELL], deckCount: 40, sideboardCount: 15 },
    { playerId: 2, name: 'Opp', table: [BEAR, AURA], handCount: 5, deckCount: 33, life: 17 },
    { playerId: 3, name: 'Third' },
  ],
};

const OWN: BoardCell = { playerId: 1, isLocal: true, mirrored: false, canAct: true, showHand: true, row: 1, col: 0 };
const OPP: BoardCell = { playerId: 2, isLocal: false, mirrored: true, canAct: false, showHand: false, row: 0, col: 0 };

function renderModel(cell: BoardCell, options: {
  totalPlayers?: number;
  mutate?: (state: ReturnType<typeof buildSeatGameState>) => void;
  gameId?: number | undefined;
} = {}) {
  const { totalPlayers = 2, mutate } = options;
  const gameId = 'gameId' in options ? options.gameId : 1;
  const preloadedState = buildSeatGameState(SPEC);
  mutate?.(preloadedState);
  const seen: PlayerBoardModel[] = [];
  function Probe() {
    seen.push(usePlayerSeatViewModel(cell, totalPlayers));
    return null;
  }
  const utils = renderWithProviders(<Probe />, { preloadedState, gameId });
  return { ...utils, model: () => seen[seen.length - 1], renders: () => seen.length };
}

describe('usePlayerSeatViewModel', () => {
  it('does not render a seat for unrelated life, hand or battlefield changes', () => {
    const { store, model, renders } = renderModel(OWN);
    const before = model();
    const count = renders();
    act(() => store.dispatch(games.Actions.counterSet({
      gameId: 1, playerId: 2, data: create(Event_SetCounterSchema, { counterId: LIFE_COUNTER_ID, value: 16 }),
    })));
    act(() => store.dispatch(games.Actions.zoneCardCountAdjusted({
      gameId: 1, playerId: 2, zoneName: ZoneName.HAND, delta: 1,
    })));
    act(() => store.dispatch(games.Actions.cardMovedInSameZone({
      gameId: 1, playerId: 2, zoneName: ZoneName.TABLE, cardId: 20, toIndex: 0,
      card: makeCard({ ...BEAR, tapped: true }),
    })));
    expect(renders()).toBe(count);
    expect(model()).toBe(before);
    expect(store.getState().games.games[1].players[2].zones.table.byId[20].tapped).toBe(true);
  });

  it('updates foreign attachment content, membership and order while retaining reveal targets', () => {
    const { store, model } = renderModel(OWN);
    const targets = model().seat.revealTargets;
    const move = (card: typeof AURA, toIndex: number) => act(() => store.dispatch(games.Actions.cardMovedInSameZone({
      gameId: 1, playerId: 2, zoneName: ZoneName.TABLE, cardId: card.id, toIndex, card,
    })));
    move(makeCard({ ...AURA, tapped: true }), 1);
    expect(model().zones.battlefield.cards.at(-1)).toMatchObject({ id: '21', tapped: true, ownerPlayerId: 2 });
    move(makeCard({ ...BEAR, attachPlayerId: 1, attachZone: ZoneName.TABLE, attachCardId: 10 }), 1);
    expect(model().zones.battlefield.cards.map((card) => card.id)).toEqual(['10', '11', '21', '20']);
    move(makeCard({ ...AURA, attachCardId: -1 }), 0);
    expect(model().zones.battlefield.cards.map((card) => card.id)).toEqual(['10', '11', '20']);
    expect(model().seat.revealTargets).toBe(targets);
  });

  it('updates reveal target names and seating without rebuilding the battlefield', () => {
    const { store, model } = renderModel(OWN, { mutate: (state) => {
      state.games.pings = { 1: {} };
    } });
    const battlefield = model().zones.battlefield;
    act(() => store.dispatch(games.Actions.playerPropertiesUpdated({
      gameId: 1, playerId: 2, properties: makePlayerProperties({ playerId: 2, userInfo: { name: 'Renamed' } }),
    })));
    expect(model().seat.revealTargets[0]).toEqual({ playerId: 2, name: 'Renamed' });
    act(() => store.dispatch(games.Actions.playerPropertiesUpdated({
      gameId: 1, playerId: 3, properties: makePlayerProperties({ playerId: 3, conceded: true }),
    })));
    expect(model().seat.revealTargets).toEqual([{ playerId: 2, name: 'Renamed' }]);
    expect(model().zones.battlefield).toBe(battlefield);
  });

  it('projects the seat identity, turn and layout flags', () => {
    expect(renderModel(OWN).model().seat).toEqual({
      playerId: 1,
      hydrated: true,
      isLocal: true,
      mirrored: false,
      handPlacement: 'inline',
      isActive: false,
      displayName: 'P1',
      username: 'P1',
      avatarUrl: null,
      flipHandCardBacks: true,
      drawSeq: 0,
      lastDrawCount: 0,
      revealTargets: [{ playerId: 2, name: 'Opp' }, { playerId: 3, name: 'Third' }],
    });
    expect(renderModel(OPP, { totalPlayers: 3 }).model().seat).toMatchObject({
      isActive: true,
      mirrored: true,
      handPlacement: 'hidden',
      flipHandCardBacks: false,
      displayName: 'Opp',
    });
    expect(renderModel(OWN).model().permissions).toEqual({ isOwner: true, canAct: true });
    expect(renderModel(OPP).model().permissions).toEqual({ isOwner: false, canAct: false });
  });

  it('falls back to a placeholder identity before the player hydrates', () => {
    const { seat, zones, counters } = renderModel({ ...OPP, playerId: 9 }).model();
    expect(seat).toMatchObject({ hydrated: false, isActive: false, displayName: 'Player 9', username: 'player-9' });
    expect(renderModel({ ...OWN, playerId: 9 }).model().seat).toMatchObject({ displayName: 'You', username: 'you' });
    expect(zones.library.cardCount).toBeUndefined();
    expect(zones.hand.cards).toEqual([]);
    expect(counters).toEqual({ life: undefined, mana: {} });
  });

  it('reads hidden-zone counts from cardCount and keeps an opponent hand secret', () => {
    const own = renderModel(OWN).model().zones;
    expect(own.library).toMatchObject({ cardCount: 40, revealedCards: [] });
    expect(own.sideboard).toEqual({ cardCount: 15, revealedCards: [] });
    expect(own.hand).toEqual({ cardCount: 1, cards: [{ id: '30', name: 'Shock', scryfallId: 'shock-pid', annotation: undefined }] });

    const opp = renderModel(OPP).model().zones;
    expect(opp.hand).toEqual({ cardCount: 5, cards: [] });
    expect(opp.library.cardCount).toBe(33);
  });

  it('keeps pile order bottom → top and the stack annotation', () => {
    const { graveyard, exile, stack } = renderModel(OWN).model().zones;
    expect(graveyard.cards.map((c) => c.name)).toEqual(['Duress', 'Opt']);
    expect(graveyard.cardCount).toBe(2);
    expect(exile).toEqual({ cards: [], cardCount: 0 });
    expect(stack.cards).toEqual([{ id: '50', name: 'Counterspell', scryfallId: '', annotation: 'targets Bolt' }]);
  });

  it('decodes wire x into column and sub-slot', () => {
    const cards = renderModel(OWN).model().zones.battlefield.cards;
    expect(cards.find((c) => c.id === '10')).toEqual({
      id: '10',
      ownerPlayerId: 1,
      name: 'Bolt',
      scryfallId: 'bolt-pid',
      slot: { row: 1, col: 1 },
      subSlot: 1,
      tapped: false,
      faceDown: false,
      pt: undefined,
      doesntUntap: false,
      color: undefined,
      annotation: undefined,
      attachTargetCardId: undefined,
      attachTargetPlayerId: undefined,
      counters: [],
    });
    expect(cards.find((c) => c.id === '11')).toMatchObject({ slot: { row: 0, col: 0 }, tapped: true, pt: '3/3', annotation: 'big' });
  });

  it('moves cross-player attachments under their parent while keeping the owner', () => {
    const own = renderModel(OWN).model().zones.battlefield.cards.map((c) => [c.id, c.ownerPlayerId]);
    expect(own).toEqual([['10', 1], ['11', 1], ['21', 2]]);
    const opp = renderModel(OPP).model().zones.battlefield.cards;
    expect(opp.map((c) => [c.id, c.ownerPlayerId])).toEqual([['20', 2], ['12', 1]]);
    expect(opp[1]).toMatchObject({ attachTargetPlayerId: 2, attachTargetCardId: 20 });
  });

  it('projects revealed snapshots and the known top card', () => {
    const { library, sideboard } = renderModel(OWN, {
      mutate: (state) => {
        const zones = state.games!.games![1]!.players![1]!.zones!;
        zones[ZoneName.DECK]!.revealedCards = [makeCard({ id: 0, name: 'Top' }), makeCard({ id: 1, name: 'Next' })];
        zones[ZoneName.DECK]!.topRevealedCard = makeCard({ id: 0, name: 'Top', providerId: 'top-pid' });
        zones[ZoneName.DECK]!.alwaysLookAtTopCard = true;
        zones[ZoneName.SIDEBOARD]!.revealedCards = [makeCard({ id: 0, name: 'Side' })];
      },
    }).model().zones;
    expect(library).toEqual({
      cardCount: 40,
      revealedCards: [
        { id: '0', name: 'Top', scryfallId: '' },
        { id: '1', name: 'Next', scryfallId: '' },
      ],
      topCard: { name: 'Top', scryfallId: 'top-pid' },
      alwaysRevealTopCard: false,
      alwaysLookAtTopCard: true,
    });
    expect(sideboard.revealedCards).toEqual([{ id: '0', name: 'Side', scryfallId: '' }]);
  });

  it('finds the life counter and the mana pool by wire name', () => {
    const { counters } = renderModel(OPP).model();
    expect(counters.life).toEqual({ id: LIFE_COUNTER_ID, value: 17 });
    expect(counters.mana).toEqual({
      W: { id: MANA_COUNTER_IDS.w, count: 0 },
      U: { id: MANA_COUNTER_IDS.u, count: 0 },
      B: { id: MANA_COUNTER_IDS.b, count: 0 },
      R: { id: MANA_COUNTER_IDS.r, count: 0 },
      G: { id: MANA_COUNTER_IDS.g, count: 0 },
      C: { id: MANA_COUNTER_IDS.x, count: 0 },
      O: { id: MANA_COUNTER_IDS.storm, count: 0 },
    });
  });

  it('projects the loaded deck list, sideboard included, and nothing when it does not parse', () => {
    const deckList = '<?xml version="1.0"?><cockatrice_deck version="1"><deckname>Burn</deckname>'
      + '<zone name="main"><card number="4" name="Lightning Bolt" uuid="bolt-uuid"/><card number="20" name="Mountain"/></zone>'
      + '<zone name="side"><card number="2" name="Smash to Smithereens"/></zone></cockatrice_deck>';
    const withDeck = (list: string) => (state: ReturnType<typeof buildSeatGameState>) => {
      state.games.games[1].players[1].deckList = list;
    };
    expect(renderModel(OWN, { mutate: withDeck(deckList) }).model().deck).toEqual([
      { name: 'Lightning Bolt', scryfallId: 'bolt-uuid', sideboard: false, commander: false },
      { name: 'Mountain', scryfallId: '', sideboard: false, commander: false },
      { name: 'Smash to Smithereens', scryfallId: '', sideboard: true, commander: false },
    ]);
    expect(renderModel(OWN, { mutate: withDeck('not a deck') }).model().deck).toEqual([]);
    expect(renderModel(OPP).model().deck).toEqual([]);
  });

  it('lists the zones beyond the seven builtins as custom zones', () => {
    const model = renderModel(OWN, {
      mutate: (state) => {
        state.games!.games![1]!.players![1]!.zones!.command = makeZoneEntry({
          name: 'command',
          type: 1,
          withCoords: false,
          cards: [makeCard({ id: 70, name: 'Kenrith' })],
          cardCount: 1,
        });
      },
    }).model();
    expect(model.zones.customZones).toEqual([expect.objectContaining({
      name: 'command', type: 1, withCoords: false, cardCount: 1,
      cards: [expect.objectContaining({ id: '70', name: 'Kenrith' })],
    })]);
    expect(renderModel(OPP).model().zones.customZones).toEqual([]);
  });

  it('is empty without an active game', () => {
    const { seat, zones } = renderModel(OWN, { gameId: undefined }).model();
    expect(seat).toMatchObject({ hydrated: false, displayName: 'You', revealTargets: [] });
    expect(zones.battlefield.cards).toEqual([]);
  });

});
