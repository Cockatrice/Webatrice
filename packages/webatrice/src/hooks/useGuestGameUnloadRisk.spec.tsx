import { act } from '@testing-library/react';
import { games } from '@cockatrice/datatrice';
import { makeGameEntry, makePlayerEntry, makePlayerProperties } from '@cockatrice/datatrice/testing';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import { connectedState, makeUser, renderWithProviders } from '../__test-utils__';
import { hasUnloadRisk } from '../services/unloadGuard';
import { useGuestGameUnloadRisk } from './useGuestGameUnloadRisk';

function Probe() {
  useGuestGameUnloadRisk();
  return null;
}

it.each([
  { registered: false, spectator: false, started: true, replay: false, conceded: false, expected: true },
  { registered: true, spectator: false, started: true, replay: false, conceded: false, expected: false },
  { registered: false, spectator: true, started: true, replay: false, conceded: false, expected: false },
  { registered: false, spectator: false, started: false, replay: false, conceded: false, expected: false },
  { registered: false, spectator: false, started: true, replay: true, conceded: false, expected: false },
  { registered: false, spectator: false, started: true, replay: false, conceded: true, expected: false },
])('guards only an active guest player: %j', ({ registered, expected, conceded, ...game }) => {
  const { store, unmount } = renderWithProviders(<Probe />, {
    preloadedState: {
      ...connectedState,
      server: {
        ...connectedState.server!,
        user: makeUser({ userLevel: registered ? ServerInfo_User_UserLevelFlag.IsRegistered : 0 }),
      },
      games: {
        games: { 1: makeGameEntry({ ...game, players: { 1: makePlayerEntry({ properties: makePlayerProperties({ conceded }) }) } }) },
        pings: {},
      },
    },
  });
  expect(hasUnloadRisk()).toBe(expected);
  act(() => store.dispatch(games.Actions.gameClosed({ gameId: 1 })));
  expect(hasUnloadRisk()).toBe(false);
  unmount();
});
