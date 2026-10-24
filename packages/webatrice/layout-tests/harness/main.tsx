import '../../src/polyfills';

import { Suspense, useEffect } from 'react';
import { create } from '@bufbuild/protobuf';
import { rooms } from '@cockatrice/datatrice';
import { Event_RoomSaySchema } from '@cockatrice/sockatrice/generated';
import { createRoot } from 'react-dom/client';
import { StyledEngineProvider } from '@mui/material/styles';

import { DatatriceProvider, WebClientProvider } from '@cockatrice/datatrice/react';
import { makeUser } from '@cockatrice/datatrice/testing';
import { extensions, useAppDispatch } from '@app/store';
import { AppThemeProvider } from '@app/components';
import { currentMaxExpandedChats, dispatchChatDock } from '@app/hooks';
import { CLIENT_CONFIG, CLIENT_OPTIONS } from '../../src/clientConfig';
import AppShell from '../../src/AppShell';
import { connected31State, connectedWithRoomsState } from '../../src/__test-utils__/storeFixtures';
import { buildLayoutGame } from './fixture';
import { setCachedDraft } from '../../src/features/decks/deckEditorCache';

import '../../src/i18n';
import '../../src/index.css';

const query = new URLSearchParams(window.location.search);
const players = Number(query.get('players') ?? 4);
const spectator = query.get('as') === 'spectator';
const chatPeers = ['mainman879', 'Bobby4261789', 'Jsiggy54', 'GolbogDoomslay'];

Object.defineProperty(window, 'onbeforeunload', { configurable: true, get: () => null, set: () => undefined });
const route = query.get('route');
window.localStorage.setItem('webatrice.lastRoute', route === 'home' ? '/'
  : route === 'room' ? '/room/1' : route === 'deck' ? '/deck/draft/layout' : '/game/1');
if (route === 'deck') {
  setCachedDraft('layout', { name: '', meta: { v: 1, updatedAt: '2026-10-11T00:00:00Z' }, cards: [], format: '' });
}

const game = buildLayoutGame({ players, spectator });
const self = makeUser({ name: spectator ? 'AzureJay' : 'Alex' });
const seated = Object.values(game.players).map((p) => p.properties.userInfo!);
const users = Object.fromEntries(
  [self, ...chatPeers.map((name) => makeUser({ name })), ...seated].map((u) => [u.name, u]),
);
const base = connected31State as Record<string, Record<string, unknown>>;
const state = {
  ...base,
  server: { ...base.server, user: self, users: { ...(base.server.users as object), ...users } },
  rooms: query.get('route') === 'room' ? {
    ...connectedWithRoomsState.rooms,
    rooms: { 1: { ...connectedWithRoomsState.rooms!.rooms[1], users: Object.fromEntries(
      Array.from({ length: 403 }, (_, index) => {
        const user = makeUser({ name: `person${index}` });
        return [user.name, user];
      }),
    ) } },
    messages: { 1: Array.from({ length: 320 }, (_, index) => ({
      ...create(Event_RoomSaySchema, {
        name: `speaker${index}`,
        message: `speaker${index}: line ${index} https://example.com/${index} @person1 ${'wrapped words '.repeat(index % 5 * 12)}`,
      }),
      id: index + 1000,
      timeReceived: 1,
    })) },
  } : { ...base.rooms, joinedGameIds: { 1: { 1: true } } },
  games: { ...base.games, games: { 1: game } },
};

const keepSession = () => (next: (a: unknown) => unknown) => (a: { type?: string }) =>
  (a.type === 'server/initialized' ? a : next(a));

declare global {
  interface Window {
    layoutHarness: { openChats: (open: number, minimised?: number) => void; closeChats: () => void; say: (message: string) => void };
  }
}
window.layoutHarness = {
  openChats: (open, minimised = 0) => {
    const names = chatPeers.slice(0, open + minimised);
    names.forEach((name) => dispatchChatDock({ type: 'open', name, max: currentMaxExpandedChats(name) }));
    names.slice(0, minimised).forEach((name) => dispatchChatDock({ type: 'minimise', name }));
  },
  closeChats: () => chatPeers.forEach((name) => dispatchChatDock({ type: 'close', name })),
  say: () => undefined,
};

function RoomActions() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    window.layoutHarness.say = (message) => dispatch(rooms.Actions.roomSayReceived({
      roomId: 1, message: { ...create(Event_RoomSaySchema, { name: 'arrival', message }), timeReceived: Date.now() },
    }));
  }, [dispatch]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <DatatriceProvider extensions={extensions} preloadedState={state as never} additionalMiddleware={[keepSession as never]}>
    <WebClientProvider config={CLIENT_CONFIG} options={CLIENT_OPTIONS}>
      <StyledEngineProvider injectFirst>
        <AppThemeProvider>
          <Suspense fallback="loading">
            <RoomActions />
            <AppShell />
          </Suspense>
        </AppThemeProvider>
      </StyledEngineProvider>
    </WebClientProvider>
  </DatatriceProvider>,
);
