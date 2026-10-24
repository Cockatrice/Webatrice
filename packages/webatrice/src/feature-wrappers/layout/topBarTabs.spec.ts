import type { TFunction } from 'i18next';

import { RouteEnum } from '@app/types';

import {
  addStickyTab,
  deckIdOfTab,
  detectTransientTab,
  isPlaceTab,
  isStickyTabType,
  routeMatches,
  stripGroupOf,
  stripGroups,
  tabTitle,
  tabUnread,
  withDeckNames,
  type Tab,
} from './topBarTabs';

const deckTab = (id: string): Tab => detectTransientTab(`/deck/${id}`)!;

describe('detectTransientTab', () => {
  it.each([
    ['/decks', { key: 'decks', type: 'decks', titleKey: 'TopBar.tab.myDecks' }],
    ['/deck/12', { key: 'deck:12', type: 'deck', titleKey: 'TopBar.tab.deck', titleParams: { id: '12' } }],
    ['/deck/draft/abc', { key: 'deck-draft:abc', type: 'deck', titleKey: 'TopBar.tab.unsavedDeck' }],
    ['/settings', { key: 'settings', type: 'settings', titleKey: 'UserMenu.settings' }],
    ['/shortcuts', { key: 'shortcuts', type: 'shortcuts', titleKey: 'UserMenu.shortcuts' }],
    ['/account', { key: 'account', type: 'account', titleKey: 'UserMenu.account' }],
    ['/logs', { key: 'logs', type: 'logs', titleKey: 'UserMenu.logs' }],
    ['/administration', { key: 'administration', type: 'staff', titleKey: 'UserMenu.administration' }],
    ['/report-queue', { key: 'report-queue', type: 'staff', titleKey: 'UserMenu.reportQueue' }],
    ['/my-reports', { key: 'my-reports', type: 'my-reports', titleKey: 'UserMenu.myReports' }],
    ['/player/alice', { key: 'player:alice', type: 'player', title: 'alice' }],
    ['/replays', { key: 'replays', type: 'replays', titleKey: 'TopBar.replays.tab' }],
    ['/replay/r1', { key: 'replay:r1', type: 'replay', titleKey: 'TopBar.replayTab' }],
  ])('makes a closeable tab for %s', (pathname, expected) => {
    expect(detectTransientTab(pathname)).toEqual({ ...expected, route: pathname, closeable: true });
  });

  it('names a public deck list after its owner', () => {
    const pathname = RouteEnum.PUBLIC_DECKS.replace(':userName', 'bob');

    expect(detectTransientTab(pathname)).toMatchObject({
      key: 'public-decks:bob', type: 'decks', titleKey: 'TopBar.tab.publicDecks', titleParams: { name: 'bob' },
    });
  });

  it.each([RouteEnum.SERVER, '/room/1', '/game/2', '/nowhere'])('makes none for %s', (pathname) => {
    expect(detectTransientTab(pathname)).toBeNull();
  });
});

describe('isStickyTabType', () => {
  it('keeps deck lists, decks and shortcuts, not private chats', () => {
    expect(['decks', 'deck', 'shortcuts'].every((type) => isStickyTabType(type as Tab['type']))).toBe(true);
    expect(isStickyTabType('player')).toBe(false);
  });

  it('lets every other page go when the user leaves it', () => {
    expect(['server', 'room', 'game', 'settings', 'account', 'logs', 'staff', 'replays', 'replay', 'my-reports']
      .some((type) => isStickyTabType(type as Tab['type']))).toBe(false);
  });
});

describe('deckIdOfTab', () => {
  it('reads the server deck id of a saved deck', () => {
    expect(deckIdOfTab(deckTab('42'))).toBe(42);
  });

  it('has none for a draft or any other tab', () => {
    expect(deckIdOfTab(detectTransientTab('/deck/draft/abc')!)).toBeNull();
    expect(deckIdOfTab(detectTransientTab('/decks')!)).toBeNull();
  });
});

describe('tabTitle', () => {
  const t = ((key: string, params?: Record<string, string>) => `${key}${params ? JSON.stringify(params) : ''}`) as TFunction;

  it('prefers the tab\'s own name', () => {
    expect(tabTitle({ ...deckTab('1'), title: 'Burn' }, t)).toBe('Burn');
  });

  it('translates the catalogue title with its params', () => {
    expect(tabTitle(deckTab('1'), t)).toBe('TopBar.tab.deck{"id":"1"}');
  });
});

describe('routeMatches', () => {
  it('matches a route pattern exactly', () => {
    expect(routeMatches('/room/3', RouteEnum.ROOM)).toBe(true);
    expect(routeMatches('/room/3/extra', RouteEnum.ROOM)).toBe(false);
  });

  it('never matches the wildcard route', () => {
    expect(routeMatches('/anything', '*')).toBe(false);
  });
});

describe('addStickyTab', () => {
  it('appends a new tab and leaves a known one in place', () => {
    const one = [deckTab('1')];
    const two = addStickyTab(one, deckTab('2'));

    expect(two.map(({ key }) => key)).toEqual(['deck:1', 'deck:2']);
    expect(addStickyTab(two, deckTab('1'))).toBe(two);
  });

  it('puts a deck loaded into a tab in that tab\'s place', () => {
    const next = addStickyTab([deckTab('1'), deckTab('2')], deckTab('3'), 1);

    expect(next.map(({ key }) => key)).toEqual(['deck:3', 'deck:2']);
  });

  it('closes the replaced tab when the loaded deck already has one', () => {
    const next = addStickyTab([deckTab('1'), deckTab('2')], deckTab('2'), 1);

    expect(next.map(({ key }) => key)).toEqual(['deck:2']);
  });

  it('just appends when the replaced deck has no tab', () => {
    const next = addStickyTab([deckTab('1')], deckTab('3'), 9);

    expect(next.map(({ key }) => key)).toEqual(['deck:1', 'deck:3']);
  });
});

describe('withDeckNames', () => {
  it('titles saved decks from the deck list', () => {
    const tabs = [deckTab('1'), deckTab('2'), detectTransientTab('/decks')!];

    const named = withDeckNames(tabs, new Map([[1, 'Burn']]));

    expect(named.map(({ title }) => title)).toEqual(['Burn', undefined, undefined]);
  });

  it('returns the same list when no title changes', () => {
    const tabs = [{ ...deckTab('1'), title: 'Burn' }];

    expect(withDeckNames(tabs, new Map([[1, 'Burn']]))).toBe(tabs);
    expect(withDeckNames(tabs, new Map())).toBe(tabs);
  });
});

describe('stripGroups', () => {
  const tab = (key: string, type: Tab['type']): Tab => ({ key, type, title: key, route: `/${key}`, closeable: true });

  it('leaves private chats to the chat dock and the People page', () => {
    expect(stripGroupOf(tab('player:bob', 'player'))).toBeNull();
  });

  it('leaves places to the rail', () => {
    for (const place of [tab('server', 'server'), tab('decks', 'decks'), tab('replays', 'replays'), tab('settings', 'settings')]) {
      expect(isPlaceTab(place)).toBe(true);
      expect(stripGroupOf(place)).toBeNull();
    }
  });

  it('files sessions by kind, with public deck lists among decks and other pages last', () => {
    expect(stripGroupOf(tab('public-decks:bob', 'decks'))).toBe('decks');
    expect(stripGroupOf(tab('report-queue', 'staff'))).toBe('pages');
    expect(stripGroupOf(tab('account', 'account'))).toBe('pages');
  });

  it('orders groups rooms, games, decks, replays, pages and keeps tab order within each', () => {
    const groups = stripGroups([
      tab('server', 'server'),
      tab('player:a', 'player'),
      tab('game:2', 'game'),
      tab('room:1', 'room'),
      tab('game:3', 'game'),
      tab('account', 'account'),
      tab('replay:x', 'replay'),
      tab('deck:4', 'deck'),
    ]);

    expect(groups.map(({ key, tabs }) => [key, tabs.map((t) => t.key)])).toEqual([
      ['rooms', ['room:1']],
      ['games', ['game:2', 'game:3']],
      ['decks', ['deck:4']],
      ['replays', ['replay:x']],
      ['pages', ['account']],
    ]);
  });

  it('drops empty groups', () => {
    expect(stripGroups([tab('server', 'server')])).toEqual([]);
  });
});

describe('tabUnread', () => {
  const counts = { rooms: { 1: 3 }, games: { 9: 2 } };

  it('reads the count of the room or game behind a tab', () => {
    expect(tabUnread({ key: 'room:1', type: 'room' }, counts)).toBe(3);
    expect(tabUnread({ key: 'game:9', type: 'game' }, counts)).toBe(2);
  });

  it('is zero for anything else or anything unknown', () => {
    expect(tabUnread({ key: 'room:2', type: 'room' }, counts)).toBe(0);
    expect(tabUnread({ key: 'deck:1', type: 'deck' }, counts)).toBe(0);
  });
});
