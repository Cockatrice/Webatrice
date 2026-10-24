import { ZoneName } from '@cockatrice/sockatrice';
import { ServerInfo_Zone_ZoneType } from '@cockatrice/sockatrice/generated';
import { renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';

import { games, type GamesState } from '@cockatrice/datatrice';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeUser,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';

import { makeReduxHookWrapper } from '../../../../__test-utils__/makeHookWrapper';
import { catalogT } from '../../__test-utils__/catalogT';
import type { ZoneViewTarget } from '../../hooks/dialogs/gameDialogs.types';
import gameLogText from '../../../../feature-widgets/replay-player/formatLogDescriptor.i18n.json';
import zoneLabels from '../shared/zoneLabels.i18n.json';
import zoneViewTitles from './useZoneViewDialog.i18n.json';
import { useZoneViewDialog, zoneViewTitle } from './useZoneViewDialog';

const englishT = catalogT(zoneLabels, zoneViewTitles, gameLogText);

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: englishT }) }));

function setup(zoneArgs: Parameters<typeof makeZoneEntry>[0]) {
  const game = makeGameEntry({
    localPlayerId: 1,
    players: {
      1: makePlayerEntry({
        properties: makePlayerProperties({
          playerId: 1,
          userInfo: makeUser({ name: 'Trajer' }),
        }),
        zones: {
          [zoneArgs.name!]: makeZoneEntry(zoneArgs),
        },
      }),
    },
  });
  const gamesState: GamesState = { games: { 1: { ...game, info: { ...game.info, gameId: 1 } } }, pings: {} };

  return makeReduxHookWrapper(
    combineReducers({ games: games.gamesReducer }),
    { games: gamesState },
  );
}

function render(view: ZoneViewTarget, wrapper: ReturnType<typeof setup>['Wrapper'], gameId: number | undefined) {
  return renderHook(() => useZoneViewDialog(gameId, view), { wrapper }).result.current;
}

describe('zoneViewTitle', () => {
  it.each([
    [{ zoneName: ZoneName.DECK }, 'P1\'s library'],
    [{ zoneName: ZoneName.DECK, numberCards: 3 }, 'Top 3 cards — P1'],
    [{ zoneName: ZoneName.DECK, numberCards: 3, isReversed: true }, 'Bottom 3 cards — P1'],
    [{ zoneName: ZoneName.GRAVE }, 'Graveyard — P1'],
    [{ zoneName: ZoneName.EXILE }, 'Exile — P1'],
    [{ zoneName: ZoneName.HAND }, 'Hand — P1'],
    [{ zoneName: ZoneName.SIDEBOARD }, 'Sideboard — P1'],
  ])('%o reads %s', (view, title) => {
    expect(zoneViewTitle(englishT, { playerId: 1, ...view }, 'P1', 3)).toBe(title);
  });

  it('translates each title as one message, so a language can reorder it', () => {
    const germanT = catalogT({
      ZoneLabel: { title: { grave: 'Friedhof' } },
      ZoneViewTitle: { zone: '{zone} von {player}', library: 'Bibliothek von {player}', top: 'Oberste {count} Karten von {player}' },
    });
    expect(zoneViewTitle(germanT, { playerId: 1, zoneName: ZoneName.GRAVE }, 'P1', 3)).toBe('Friedhof von P1');
    expect(zoneViewTitle(germanT, { playerId: 1, zoneName: ZoneName.DECK }, 'P1', 3)).toBe('Bibliothek von P1');
    expect(zoneViewTitle(germanT, { playerId: 1, zoneName: ZoneName.DECK, numberCards: 3 }, 'P1', 3)).toBe('Oberste 3 Karten von P1');
  });
});

describe('useZoneViewDialog', () => {
  it('uses the dump snapshot for a hidden custom zone', () => {
    const { Wrapper } = setup({
      name: 'vault', type: ServerInfo_Zone_ZoneType.HiddenZone, cardCount: 3,
      cards: [makeCard({ id: 8, name: 'Stale card' })],
      revealedCards: [makeCard({ id: 0, name: 'Opt' })],
    });
    expect(render({ playerId: 1, zoneName: 'vault' }, Wrapper, 1).cards.map((card) => card.name)).toEqual(['Opt']);
  });

  it('lists a public zone bottom to top, as the seat projects it', () => {
    const { Wrapper } = setup({
      name: ZoneName.GRAVE,
      cards: [makeCard({ id: 1, name: 'Opt', providerId: 'p1' }), makeCard({ id: 2, name: 'Duress' })],
      cardCount: 2,
    });

    const view = render({ playerId: 1, zoneName: ZoneName.GRAVE }, Wrapper, 1);

    expect(view.cards.map((c) => [c.id, c.name])).toEqual([['1', 'Opt'], ['2', 'Duress']]);
    expect(view.cards[0].scryfallId).toBe('p1');
    expect(view.count).toBe(2);
    expect(view.title).toBe('Graveyard — Trajer');
    expect(view.isLocal).toBe(true);
  });

  it('lists a custom zone\'s cards under its own name', () => {
    const { Wrapper } = setup({ name: 'command', cards: [makeCard({ id: 7, name: 'Kenrith' })], cardCount: 1 });

    const view = render({ playerId: 1, zoneName: 'command' }, Wrapper, 1);

    expect(view.cards.map((c) => c.name)).toEqual(['Kenrith']);
    expect(view.count).toBe(1);
    expect(view.title).toBe('command — Trajer');
  });

  it('shows only the count of a hidden custom zone', () => {
    const { Wrapper } = setup({ name: 'vault', cards: [], cardCount: 3 });
    const view = render({ playerId: 1, zoneName: 'vault' }, Wrapper, 1);
    expect(view.cards).toEqual([]);
    expect(view.count).toBe(3);
  });

  it('lists the revealed dump snapshot of a hidden zone, not its byId cards', () => {
    const { Wrapper } = setup({
      name: ZoneName.DECK,
      type: ServerInfo_Zone_ZoneType.HiddenZone,
      cards: [],
      cardCount: 40,
      revealedCards: [makeCard({ id: 0, name: 'Island' }), makeCard({ id: 1, name: 'Ponder' })],
    });

    const view = render({ playerId: 1, zoneName: ZoneName.DECK }, Wrapper, 1);

    expect(view.cards.map((c) => c.name)).toEqual(['Island', 'Ponder']);
    expect(view.count).toBe(40);
    expect(view.title).toBe('Trajer\'s library');
  });

  it('is empty without a current game', () => {
    const { Wrapper } = setup({ name: ZoneName.GRAVE, cards: [makeCard({ id: 1 })], cardCount: 1 });

    const view = render({ playerId: 1, zoneName: ZoneName.GRAVE }, Wrapper, undefined);

    expect(view.cards).toEqual([]);
    expect(view.count).toBe(0);
  });
});
