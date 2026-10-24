import { matchPath } from 'react-router-dom';
import type { TFunction } from 'i18next';

import { RouteEnum } from '@app/types';

export type TabType =
  | 'server'
  | 'room'
  | 'game'
  | 'decks' // /decks — My Decks list
  | 'deck' // /deck/:id — deck editor
  | 'my-decks'
  | 'settings'
  | 'shortcuts'
  | 'account'
  | 'logs'
  | 'player'
  | 'staff'
  | 'replays'
  | 'replay'
  | 'my-reports'
  | 'unknown';

export interface Tab {
  key: string;
  type: TabType;
  title?: string;
  titleKey?: string;
  titleParams?: Record<string, string>;
  route: string;
  closeable: boolean;
  spectating?: boolean;
  onClose?: () => void;
}

export function isStickyTabType(type: TabType): boolean {
  return type === 'decks' || type === 'deck' || type === 'shortcuts';
}

export function deckIdOfTab(tab: Tab): number | null {
  if (tab.type !== 'deck') {
    return null;
  }
  const match = tab.key.match(/^deck:(\d+)$/);
  return match ? Number(match[1]) : null;
}

export function tabTitle(tab: Tab, t: TFunction): string {
  return tab.title ?? (tab.titleKey ? t(tab.titleKey, tab.titleParams) : '');
}

/** True when `pathname` is served by `route` (route may contain
 *  :params). Handles the wildcard `*` fallback used for the initialize
 *  route by never matching it here. */
export function routeMatches(pathname: string, route: string): boolean {
  if (route === '*') {
    return false;
  }
  return matchPath({ path: route, end: true }, pathname) !== null;
}

const STAFF_TABS: { key: string; titleKey: string; route: RouteEnum }[] = [
  { key: 'administration', titleKey: 'UserMenu.administration', route: RouteEnum.ADMINISTRATION },
  { key: 'moderation', titleKey: 'UserMenu.moderation', route: RouteEnum.MODERATION },
  { key: 'card-art-rules', titleKey: 'UserMenu.cardArtRules', route: RouteEnum.CARD_ART_RULES },
  { key: 'developer', titleKey: 'UserMenu.developer', route: RouteEnum.DEVELOPER },
  { key: 'report-queue', titleKey: 'UserMenu.reportQueue', route: RouteEnum.REPORT_QUEUE },
];

/** Build a transient tab for the current route if it's one of the
 *  non-primary pages (Decks, Settings, Account, Logs, Player). Returns
 *  null for routes that are already covered by the primary strip
 *  (Server, Room, Game). */
export function detectTransientTab(pathname: string): Tab | null {
  if (matchPath({ path: RouteEnum.DECKS, end: true }, pathname)) {
    return { key: 'decks', type: 'decks', titleKey: 'TopBar.tab.myDecks', route: pathname, closeable: true };
  }
  const deckMatch = matchPath({ path: RouteEnum.DECK, end: true }, pathname);
  if (deckMatch) {
    const id = deckMatch.params.deckId ?? '?';
    return {
      key: `deck:${id}`,
      type: 'deck',
      titleKey: 'TopBar.tab.deck',
      titleParams: { id },
      route: pathname,
      closeable: true,
    };
  }
  const draftMatch = matchPath({ path: RouteEnum.DECK_DRAFT, end: true }, pathname);
  if (draftMatch) {
    return {
      key: `deck-draft:${draftMatch.params.token ?? '?'}`,
      type: 'deck',
      titleKey: 'TopBar.tab.unsavedDeck',
      route: pathname,
      closeable: true,
    };
  }
  if (matchPath({ path: RouteEnum.SETTINGS, end: true }, pathname)) {
    return { key: 'settings', type: 'settings', titleKey: 'UserMenu.settings', route: pathname, closeable: true };
  }
  if (matchPath({ path: RouteEnum.SHORTCUTS, end: true }, pathname)) {
    return { key: 'shortcuts', type: 'shortcuts', titleKey: 'UserMenu.shortcuts', route: pathname, closeable: true };
  }
  if (matchPath({ path: RouteEnum.ACCOUNT, end: true }, pathname)) {
    return { key: 'account', type: 'account', titleKey: 'UserMenu.account', route: pathname, closeable: true };
  }
  if (matchPath({ path: RouteEnum.LOGS, end: true }, pathname)) {
    return { key: 'logs', type: 'logs', titleKey: 'UserMenu.logs', route: pathname, closeable: true };
  }
  const staffTab = STAFF_TABS.find(({ route }) => matchPath({ path: route, end: true }, pathname));
  if (staffTab) {
    return { key: staffTab.key, type: 'staff', titleKey: staffTab.titleKey, route: pathname, closeable: true };
  }
  if (matchPath({ path: RouteEnum.MY_REPORTS, end: true }, pathname)) {
    return { key: 'my-reports', type: 'my-reports', titleKey: 'UserMenu.myReports', route: pathname, closeable: true };
  }
  const publicDecksMatch = matchPath({ path: RouteEnum.PUBLIC_DECKS, end: true }, pathname);
  if (publicDecksMatch) {
    const name = publicDecksMatch.params.userName ?? '';
    return {
      key: `public-decks:${name}`,
      type: 'decks',
      titleKey: 'TopBar.tab.publicDecks',
      titleParams: { name },
      route: pathname,
      closeable: true,
    };
  }
  const playerMatch = matchPath({ path: RouteEnum.PLAYER, end: true }, pathname);
  if (playerMatch) {
    const name = playerMatch.params.name;
    return name
      ? { key: `player:${name}`, type: 'player', title: name, route: pathname, closeable: true }
      : { key: 'player:', type: 'player', titleKey: 'TopBar.tab.player', route: pathname, closeable: true };
  }
  if (matchPath({ path: RouteEnum.REPLAYS, end: true }, pathname)) {
    return { key: 'replays', type: 'replays', titleKey: 'TopBar.replays.tab', route: pathname, closeable: true };
  }
  const replayMatch = matchPath({ path: RouteEnum.REPLAY, end: true }, pathname);
  if (replayMatch) {
    const replayKey = replayMatch.params.replayKey ?? '';
    return { key: `replay:${replayKey}`, type: 'replay', titleKey: 'TopBar.replayTab', route: pathname, closeable: true };
  }
  return null;
}

export function addStickyTab(prev: Tab[], tab: Tab, replacesDeckId?: number): Tab[] {
  const replaced = replacesDeckId != null ? prev.findIndex((t) => t.key === `deck:${replacesDeckId}`) : -1;
  if (replaced >= 0 && prev[replaced].key !== tab.key) {
    return prev.some((t) => t.key === tab.key)
      ? prev.filter((_, i) => i !== replaced)
      : prev.map((t, i) => (i === replaced ? tab : t));
  }
  return prev.some((t) => t.key === tab.key) ? prev : [...prev, tab];
}

export function withDeckNames(tabs: Tab[], deckNames: ReadonlyMap<number, string>): Tab[] {
  let changed = false;
  const next = tabs.map((tab) => {
    const id = deckIdOfTab(tab);
    const name = id != null ? deckNames.get(id) : undefined;
    if (!name || name === tab.title) {
      return tab;
    }
    changed = true;
    return { ...tab, title: name };
  });
  return changed ? next : tabs;
}

export type StripGroupKey = 'rooms' | 'games' | 'decks' | 'replays' | 'pages';

export interface StripGroup {
  key: StripGroupKey;
  tabs: Tab[];
}

const STRIP_GROUP_ORDER: readonly StripGroupKey[] = ['rooms', 'games', 'decks', 'replays', 'pages'];

const PLACE_TAB_KEYS: ReadonlySet<string> = new Set(['server', 'decks', 'replays', 'settings']);

export function isPlaceTab(tab: Pick<Tab, 'key'>): boolean {
  return PLACE_TAB_KEYS.has(tab.key);
}

export function stripGroupOf(tab: Tab): StripGroupKey | null {
  if (isPlaceTab(tab) || tab.type === 'player') {
    return null;
  }
  switch (tab.type) {
    case 'room':
      return 'rooms';
    case 'game':
      return 'games';
    case 'deck':
    case 'decks':
    case 'my-decks':
      return 'decks';
    case 'replay':
      return 'replays';
    default:
      return 'pages';
  }
}

export function stripGroups(tabs: readonly Tab[]): StripGroup[] {
  const byGroup = new Map<StripGroupKey, Tab[]>();
  for (const tab of tabs) {
    const group = stripGroupOf(tab);
    if (group) {
      byGroup.set(group, [...(byGroup.get(group) ?? []), tab]);
    }
  }
  return STRIP_GROUP_ORDER.filter((key) => byGroup.has(key)).map((key) => ({ key, tabs: byGroup.get(key)! }));
}

export interface TabUnreadCounts {
  rooms: Readonly<Record<number, number>>;
  games: Readonly<Record<number, number>>;
}

export function tabUnread(tab: Pick<Tab, 'key' | 'type'>, counts: TabUnreadCounts): number {
  const id = Number(tab.key.slice(tab.key.indexOf(':') + 1));
  switch (tab.type) {
    case 'room':
      return counts.rooms[id] ?? 0;
    case 'game':
      return counts.games[id] ?? 0;
    default:
      return 0;
  }
}
