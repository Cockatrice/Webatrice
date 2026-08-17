import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate, generatePath, matchPath } from 'react-router-dom';
import {
  User, LogOut, Home as HomeIcon, Swords, Library, LibraryBig,
  UserCircle2, Settings as SettingsIcon, FileText, X, Circle, Grid3x3,
  Keyboard,
  type LucideIcon,
} from 'lucide-react';

import { useSnapGridSetting } from '../../features/game/hooks/useSnapGridVisible';

import { server, rooms, games } from '@cockatrice/datatrice';
import type { ServerInfo_DeckStorage_TreeItem } from '@cockatrice/sockatrice/generated';
import { useAppSelector } from '@app/store';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useLeaveGame } from '@app/hooks';
import { Images } from '@app/images';
import { RouteEnum } from '@app/types';
import { clearDeckEditorCache, clearDecksListCache } from '../../features/decks';

type TabType =
  | 'server'
  | 'room'
  | 'game'
  | 'decks'   // /decks — My Decks list
  | 'deck'    // /deck/:id — deck editor
  | 'my-decks'
  | 'settings'
  | 'shortcuts'
  | 'account'
  | 'logs'
  | 'player'
  | 'unknown';

interface Tab {
  key: string;
  type: TabType;
  title: string;
  route: string;
  closeable: boolean;
  onClose?: () => void;
}

const TYPE_ICON: Record<TabType, LucideIcon> = {
  server: HomeIcon,
  room: HomeIcon,
  game: Swords,
  decks: LibraryBig,
  deck: Library,
  'my-decks': LibraryBig,
  settings: SettingsIcon,
  shortcuts: Keyboard,
  account: UserCircle2,
  logs: FileText,
  player: User,
  unknown: FileText,
};

/**
 * Fancy-themed top bar. Purely a view over react-router: tabs are
 * derived from the current route + Redux state (joined rooms, active
 * games) so navigating anywhere still works via `navigate()`. Clicking
 * a tab navigates; closing a room/game tab sends the corresponding
 * leave command through the WebSocket. The pinned "Lobby" tab is
 * always present and non-closeable, matching fancy's shape.
 */
export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const webClient = useWebClient();
  const leaveGameRequest = useLeaveGame();

  const user = useAppSelector(server.Selectors.getUser);
  const serverName = useAppSelector(server.Selectors.getName);
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const joinedRooms = useAppSelector(rooms.Selectors.getJoinedRooms);
  const activeGames = useAppSelector(games.Selectors.getActiveGames);
  const backendDecks = useAppSelector(server.Selectors.getBackendDecks);
  const [snapGridVisible, setSnapGridVisible] = useSnapGridSetting();

  // Sticky tabs = the deck-related routes the user has visited and not
  // explicitly closed. Keeps My Decks pinned alongside the currently-
  // edited deck so switching to Lobby / a room / a game doesn't drop
  // the deck editing context.
  //   • decks: one entry, always keyed 'decks'
  //   • deck : at most one entry (opening a different deck replaces
  //            the previous deck tab — same "single deck editor at a
  //            time" model the sidebar back-button used to enforce).
  //
  // Backed by a MODULE-LEVEL singleton (see bottom of this file) —
  // TopBar is rendered inside each page's Layout so it remounts on
  // every navigation, which would wipe a normal useState. The
  // singleton + useSyncExternalStore pair survives remounts.
  const [stickyTabs, setStickyTabs] = useStickyTabs();
  useEffect(() => {
    const transient = detectTransientTab(location.pathname);
    if (!transient) return;
    const shouldStick =
      transient.type === 'decks' ||
      transient.type === 'deck' ||
      transient.type === 'shortcuts';
    if (!shouldStick) return;
    setStickyTabs((prev) => {
      // Deck editor: single-slot — replace the previous 'deck' tab if any.
      if (transient.type === 'deck') {
        const others = prev.filter((t) => t.type !== 'deck');
        return [...others, transient];
      }
      // Decks list / Shortcuts: additive, no-op if already present.
      return prev.some((t) => t.key === transient.key) ? prev : [...prev, transient];
    });
  }, [location.pathname]);

  // Mirror the current pathname to localStorage so an F5 refresh drops
  // the user back on the same route (MemoryRouter has no URL to lean
  // on for this — AppShell reads the persisted value at boot).
  useEffect(() => {
    persistLastRoute(location.pathname);
  }, [location.pathname]);

  // Kick off a deckList fetch as soon as we're connected if backendDecks
  // isn't loaded yet. Otherwise a refresh directly into `/deck/:id`
  // never fires deckList (that's owned by the MyDecks page) and the
  // deck-editor sticky tab's title stays stuck on the "Deck #N"
  // fallback because deckIdToName has nothing to enrich from.
  useEffect(() => {
    if (!isConnected) return;
    if (backendDecks) return;
    webClient.request.session.deckList();
  }, [isConnected, backendDecks, webClient]);

  // Server/user identity change — deck ids are per-user on servatrice,
  // so any deck tab / cache from a previous login is stale after
  // signing into a different server or as a different user. Watch
  // `(serverName, userName)`; when it transitions to a new non-null
  // value that doesn't match the last known owner, purge deck sticky
  // tabs and both deck caches. If the user is currently sitting on a
  // now-stale deck route, bounce them to the lobby so the editor
  // doesn't try to load an id that doesn't exist here.
  const identity = useMemo(() => {
    if (!serverName || !user?.name) return null;
    return `${serverName}::${user.name}`;
  }, [serverName, user?.name]);
  useEffect(() => {
    if (identity == null) return;
    const previous = window.localStorage.getItem(STICKY_OWNER_KEY);
    if (previous && previous !== identity) {
      setStickyTabs((prev) => prev.filter((t) => t.type !== 'deck' && t.type !== 'decks'));
      clearDeckEditorCache();
      clearDecksListCache();
      if (
        location.pathname.startsWith('/deck/')
        || location.pathname === RouteEnum.DECKS
      ) {
        navigate(generatePath(RouteEnum.SERVER));
      }
    }
    window.localStorage.setItem(STICKY_OWNER_KEY, identity);
    // location.pathname / navigate intentionally excluded — the
    // owner-key mismatch check gates the wipe, and localStorage
    // updates after the wipe so subsequent path changes with the
    // same identity are no-ops. Depending on pathname would rerun
    // this effect on every route hop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, setStickyTabs]);

  // Enrich a deck-editor sticky tab with the actual deck name once
  // backendDecks has loaded it. Falls back to `Deck #N` before that.
  const deckIdToName = useMemo(() => flattenDeckNames(backendDecks), [backendDecks]);

  // Whenever the deck name enrichment ("Deck #N" → real name) resolves,
  // persist the freshly enriched title back into the sticky-tab list.
  // Without this, the next refresh would repaint from the stale
  // persisted title until deckList responds — a visible flash we can
  // just avoid by saving the good title while we have it.
  useEffect(() => {
    if (deckIdToName.size === 0) return;
    setStickyTabs((prev) => {
      let changed = false;
      const next = prev.map((tab) => {
        if (tab.type !== 'deck') return tab;
        const match = tab.key.match(/^deck:(\d+)$/);
        const id = match ? Number(match[1]) : null;
        if (id == null) return tab;
        const name = deckIdToName.get(id);
        if (!name || name === tab.title) return tab;
        changed = true;
        return { ...tab, title: name };
      });
      return changed ? next : prev;
    });
  }, [deckIdToName, setStickyTabs]);

  const tabs: Tab[] = useMemo(() => {
    const list: Tab[] = [
      {
        key: 'server',
        type: 'server',
        title: 'Lobby',
        route: generatePath(RouteEnum.SERVER),
        closeable: false,
      },
    ];

    for (const room of joinedRooms) {
      const roomId = room.info.roomId;
      list.push({
        key: `room:${roomId}`,
        type: 'room',
        title: room.info.name || `Room ${roomId}`,
        route: generatePath(RouteEnum.ROOM, { roomId: roomId.toString() }),
        closeable: true,
        onClose: () => {
          webClient.request.rooms.leaveRoom(roomId);
        },
      });
    }

    for (const game of activeGames) {
      const gameId = game.info.gameId;
      const title = game.info.description || `Game ${gameId}`;
      list.push({
        key: `game:${gameId}`,
        type: 'game',
        title,
        route: generatePath(RouteEnum.GAME, { gameId: gameId.toString() }),
        closeable: true,
        onClose: () => leaveGameRequest(gameId),
      });
    }

    // Sticky tabs (Decks list + open deck editor). Enrich the deck
    // editor's title with its actual name if backendDecks has loaded.
    for (const sticky of stickyTabs) {
      if (sticky.type === 'deck') {
        const match = sticky.key.match(/^deck:(\d+)$/);
        const deckId = match ? Number(match[1]) : null;
        const name = deckId != null ? deckIdToName.get(deckId) : undefined;
        list.push({ ...sticky, title: name ?? sticky.title });
      } else {
        list.push(sticky);
      }
    }

    // Transient tab for other non-primary routes (Settings, Account,
    // Logs, Player). Appears only while active — non-sticky.
    const transient = detectTransientTab(location.pathname);
    if (
      transient &&
      transient.type !== 'decks' &&
      transient.type !== 'deck' &&
      !list.some((t) => t.key === transient.key)
    ) {
      list.push(transient);
    }

    return list;
  }, [joinedRooms, activeGames, location.pathname, webClient, leaveGameRequest, stickyTabs, deckIdToName]);

  const activeKey = useMemo(() => {
    const match = tabs.find((t) => routeMatches(location.pathname, t.route));
    return match?.key ?? 'server';
  }, [tabs, location.pathname]);

  const handleClose = (tab: Tab) => {
    tab.onClose?.();
    // Sticky (decks / deck editor / shortcuts) tabs need to be removed
    // from the sticky list too — otherwise the effect above would leave
    // them pinned even after the user navigates away.
    if (tab.type === 'decks' || tab.type === 'deck' || tab.type === 'shortcuts') {
      setStickyTabs((prev) => prev.filter((t) => t.key !== tab.key));
    }
    if (activeKey === tab.key) {
      navigate(generatePath(RouteEnum.SERVER));
    }
  };

  return (
    <header className="relative z-40 h-14 shrink-0 bg-bg-surface/80 backdrop-blur-md border-b border-border-subtle">
      <div className="flex h-full items-center">
        {/* Logo — raw cockatrice green PNG; the brand color reads fine
             next to the purple TopBar chrome. */}
        <div className="flex items-center gap-2 shrink-0 pl-4 pr-3">
          <div className="relative">
            <img src={Images.Logo} alt="Webatrice" className="h-8 w-8 rounded-md shadow-glow" />
            <Circle
              size={8}
              strokeWidth={3}
              className={[
                'absolute -bottom-0.5 -right-0.5 stroke-bg-surface',
                isConnected ? 'text-emerald-400 fill-emerald-400' : 'text-red-400 fill-red-400',
              ].join(' ')}
              aria-label={isConnected ? 'Connected' : 'Disconnected'}
            />
          </div>
          <span className="font-modern text-lg font-bold tracking-wide text-text-primary">
            Webatrice
          </span>
        </div>

        <div className="w-px h-6 bg-border-subtle shrink-0" />

        {/* Tabs */}
        <div className="flex-1 min-w-0 h-full px-3">
          <TabList
            tabs={tabs}
            activeKey={activeKey}
            onActivate={(tab) => navigate(tab.route)}
            onClose={handleClose}
          />
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-2 shrink-0 pl-3 pr-4">
          <button
            onClick={() => navigate(generatePath(RouteEnum.DECKS))}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            title="View your decks"
          >
            <Library size={16} /> Decks
          </button>
          <div className="w-px h-6 bg-border-subtle mx-1" />
          <UserMenu
            userName={user?.name ?? null}
            snapGridVisible={snapGridVisible}
            onToggleSnapGrid={() => setSnapGridVisible(!snapGridVisible)}
            onOpenShortcuts={() => navigate(generatePath(RouteEnum.SHORTCUTS))}
            onSignOut={() => webClient.request.authentication.disconnect()}
          />
        </div>
      </div>
    </header>
  );
}

interface TabListProps {
  tabs: Tab[];
  activeKey: string;
  onActivate: (tab: Tab) => void;
  onClose: (tab: Tab) => void;
}

function TabList({ tabs, activeKey, onActivate, onClose }: TabListProps) {
  return (
    <div
      role="tablist"
      className="flex items-end h-full gap-0.5 overflow-x-auto overflow-y-hidden min-w-0"
    >
      {tabs.map((tab) => {
        const Icon = TYPE_ICON[tab.type];
        const active = tab.key === activeKey;
        return (
          <div
            key={tab.key}
            role="tab"
            aria-selected={active}
            onClick={() => onActivate(tab)}
            onAuxClick={(e) => {
              if (e.button === 1 && tab.closeable) {
                e.preventDefault();
                onClose(tab);
              }
            }}
            className={[
              'group relative flex items-center gap-2 h-9 pl-3 pr-2 rounded-t-md cursor-pointer select-none min-w-[140px] max-w-[220px] shrink-0 transition-colors',
              active
                ? 'bg-bg-base text-text-primary border border-b-0 border-border-subtle'
                : 'bg-bg-elevated/40 text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
            ].join(' ')}
          >
            <Icon size={14} className={active ? 'text-accent' : 'text-text-muted'} />
            <span className="flex-1 text-sm truncate">{tab.title}</span>
            {tab.closeable ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab);
                }}
                className="p-0.5 rounded hover:bg-border-subtle text-text-muted hover:text-text-primary opacity-60 group-hover:opacity-100 transition-opacity"
                title="Close tab"
              >
                <X size={12} />
              </button>
            ) : (
              <span className="w-4" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface UserMenuProps {
  userName: string | null;
  snapGridVisible: boolean;
  onToggleSnapGrid: () => void;
  onOpenShortcuts: () => void;
  onSignOut: () => void;
}

function UserMenu({
  userName,
  snapGridVisible,
  onToggleSnapGrid,
  onOpenShortcuts,
  onSignOut,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const displayName = userName ?? 'Signed in';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2 py-1 rounded-md bg-bg-elevated hover:bg-border-subtle transition-colors"
      >
        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-accent to-accent-secondary flex items-center justify-center">
          <User size={14} className="text-white" />
        </div>
        <span className="text-sm font-medium text-text-primary max-w-[10rem] truncate">
          {displayName}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-lg bg-bg-surface border border-border-subtle shadow-glow py-1 z-50">
          <div className="px-3 py-2 border-b border-border-subtle">
            <span className="text-sm font-medium text-text-primary truncate">{displayName}</span>
          </div>
          <button
            onClick={onToggleSnapGrid}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            aria-pressed={snapGridVisible}
          >
            <Grid3x3 size={14} />
            <span className="flex-1 text-left">Snap grid</span>
            {snapGridVisible && (
              <span className="text-xs text-accent" aria-hidden>
                ✓
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onOpenShortcuts();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            <Keyboard size={14} />
            <span className="flex-1 text-left">Shortcuts</span>
          </button>
          <div className="my-1 border-t border-border-subtle" />
          <button
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** True when `pathname` is served by `route` (route may contain
 *  :params). Handles the wildcard `*` fallback used for the initialize
 *  route by never matching it here. */
function routeMatches(pathname: string, route: string): boolean {
  if (route === '*') return false;
  return matchPath({ path: route, end: true }, pathname) !== null;
}

/** Build a transient tab for the current route if it's one of the
 *  non-primary pages (Decks, Settings, Account, Logs, Player). Returns
 *  null for routes that are already covered by the primary strip
 *  (Server, Room, Game). */
function detectTransientTab(pathname: string): Tab | null {
  if (matchPath({ path: RouteEnum.DECKS, end: true }, pathname)) {
    return { key: 'decks', type: 'decks', title: 'My Decks', route: pathname, closeable: true };
  }
  const deckMatch = matchPath({ path: RouteEnum.DECK, end: true }, pathname);
  if (deckMatch) {
    const id = deckMatch.params.deckId ?? '?';
    return {
      key: `deck:${id}`,
      type: 'deck',
      title: `Deck #${id}`, // TopBar re-titles this from backendDecks once loaded
      route: pathname,
      closeable: true,
    };
  }
  if (matchPath({ path: RouteEnum.SETTINGS, end: true }, pathname)) {
    return { key: 'settings', type: 'settings', title: 'Settings', route: pathname, closeable: true };
  }
  if (matchPath({ path: RouteEnum.SHORTCUTS, end: true }, pathname)) {
    return { key: 'shortcuts', type: 'shortcuts', title: 'Shortcuts', route: pathname, closeable: true };
  }
  if (matchPath({ path: RouteEnum.ACCOUNT, end: true }, pathname)) {
    return { key: 'account', type: 'account', title: 'Account', route: pathname, closeable: true };
  }
  if (matchPath({ path: RouteEnum.LOGS, end: true }, pathname)) {
    return { key: 'logs', type: 'logs', title: 'Logs', route: pathname, closeable: true };
  }
  const playerMatch = matchPath({ path: RouteEnum.PLAYER, end: true }, pathname);
  if (playerMatch) {
    const name = playerMatch.params.name ?? 'Player';
    return { key: `player:${name}`, type: 'player', title: name, route: pathname, closeable: true };
  }
  return null;
}

/** Walk the Servatrice deck-storage tree collecting `{deckId → name}`
 *  for every file (leaf deck). Used by TopBar to title the deck-editor
 *  sticky tab once the deck list is loaded. */
function flattenDeckNames(
  backendDecks: ReturnType<typeof server.Selectors.getBackendDecks>,
): Map<number, string> {
  const out = new Map<number, string>();
  const walk = (items: readonly ServerInfo_DeckStorage_TreeItem[] | undefined) => {
    if (!items) return;
    for (const item of items) {
      if (item.file && item.id) {
        out.set(item.id, item.name || `Deck #${item.id}`);
      } else if (item.folder) {
        walk(item.folder.items);
      }
    }
  };
  walk(backendDecks?.root?.items);
  return out;
}

// ---------- Sticky-tab singleton ----------
// TopBar remounts on every route change (it's inside per-page Layout),
// which would wipe a normal useState. This module-level pair keeps
// the sticky-tab list alive across remounts. `useSyncExternalStore`
// is React 18's official external-state binding: cheap to subscribe,
// no Context provider needed above the tree.
//
// Also persisted to localStorage so tabs survive an F5 refresh. Only
// the plain metadata (key/type/title/route/closeable) round-trips —
// `onClose` handlers aren't serializable but aren't needed either,
// since none of the tab types we mark sticky (`decks`, `deck`) carry
// an onClose; the tab-list useMemo attaches close behaviour at derive
// time based on current state.
const STICKY_STORAGE_KEY = 'webatrice.stickyTabs';
/** Owner (`${serverName}::${userName}`) of the currently-persisted
 *  sticky tabs. Written after every non-null identity settles; a
 *  mismatch on next login means we jumped servers or logged in as
 *  someone else and need to wipe stale deck tabs + caches. */
const STICKY_OWNER_KEY = 'webatrice.stickyTabs.owner';
const VALID_TAB_TYPES: TabType[] = [
  'server', 'room', 'game', 'decks', 'deck',
  'my-decks', 'settings', 'account', 'logs', 'player', 'unknown',
];

function loadPersistedStickyTabs(): Tab[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STICKY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPersistedTab);
  } catch {
    return [];
  }
}

function isValidPersistedTab(t: unknown): t is Tab {
  if (!t || typeof t !== 'object') return false;
  const rec = t as Record<string, unknown>;
  return (
    typeof rec.key === 'string' &&
    typeof rec.title === 'string' &&
    typeof rec.route === 'string' &&
    typeof rec.closeable === 'boolean' &&
    typeof rec.type === 'string' &&
    (VALID_TAB_TYPES as string[]).includes(rec.type)
  );
}

function persistStickyTabs(tabs: Tab[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Strip onClose (functions don't survive JSON) before writing.
    const serializable = tabs.map(({ key, type, title, route, closeable }) => ({
      key, type, title, route, closeable,
    }));
    window.localStorage.setItem(STICKY_STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Quota / private mode / disabled storage — nothing we can do,
    // tabs just won't persist this session.
  }
}

let stickySingleton: Tab[] = loadPersistedStickyTabs();
const stickyListeners = new Set<() => void>();

function subscribeSticky(cb: () => void): () => void {
  stickyListeners.add(cb);
  return () => {
    stickyListeners.delete(cb);
  };
}

function getStickySnapshot(): Tab[] {
  return stickySingleton;
}

function useStickyTabs(): [Tab[], (updater: (prev: Tab[]) => Tab[]) => void] {
  const tabs = useSyncExternalStore(subscribeSticky, getStickySnapshot);
  const update = useCallback((updater: (prev: Tab[]) => Tab[]) => {
    const next = updater(stickySingleton);
    if (next === stickySingleton) return; // no-op, don't notify
    stickySingleton = next;
    persistStickyTabs(next);
    stickyListeners.forEach((cb) => cb());
  }, []);
  return [tabs, update];
}

// ---------- Last-route persistence (for MemoryRouter restore) ----------
// MemoryRouter has no URL to lean on across refreshes, so we mirror the
// current pathname to localStorage. AppShell reads it back at boot and
// hands it to `<MemoryRouter initialEntries={[…]}>`. Skipped for the
// server root (default landing anyway) to avoid write churn.
const LAST_ROUTE_STORAGE_KEY = 'webatrice.lastRoute';

export function persistLastRoute(pathname: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_ROUTE_STORAGE_KEY, pathname);
  } catch {
    /* nothing we can do */
  }
}

export function loadPersistedLastRoute(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LAST_ROUTE_STORAGE_KEY);
  } catch {
    return null;
  }
}
