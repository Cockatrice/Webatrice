import { fireEvent, screen } from '@testing-library/react';
import type { MessageInitShape } from '@bufbuild/protobuf';
import {
  renderWithProviders,
  makeStoreState,
  makeUser,
  connectedWithRoomsState,
} from '../../../__test-utils__';
import {
  ServerInfo_Game,
  ServerInfo_GameSchema,
  ServerInfo_User_UserLevelFlag,
} from '@cockatrice/sockatrice/generated';
import { GameSortField, SortDirection, UserSortField } from '@cockatrice/datatrice';
import { makeGameInfo, makeRoom } from '@cockatrice/datatrice/testing';
import GamesList from './GamesList';
import { setAdminLocked } from '../../../hooks/useAdminLock';

afterEach(() => setAdminLocked(false));

const { mockUseWebClient, mockNavigate } = vi.hoisted(() => ({
  mockUseWebClient: vi.fn(),
  mockNavigate: vi.fn(),
}));
vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: mockUseWebClient };
});
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeRoomEntry(games: ServerInfo_Game[] = [], gametypeMap: Record<number, string> = {}) {
  return makeRoom({
    roomId: 1,
    name: 'Main',
    gametypeMap,
    games: Object.fromEntries(games.map((info) => [info.gameId, { info, gameType: '' }])),
  });
}

function makeGame(overrides: MessageInitShape<typeof ServerInfo_GameSchema> = {}): ServerInfo_Game {
  return makeGameInfo({
    gameId: 1,
    roomId: 1,
    description: 'Test',
    maxPlayers: 4,
    playerCount: 1,
    spectatorsAllowed: true,
    ...overrides,
  });
}

function makeWebClient() {
  return {
    request: {
      rooms: {
        joinRoom: vi.fn(),
        leaveRoom: vi.fn(),
        roomSay: vi.fn(),
        createGame: vi.fn(),
        joinGame: vi.fn(),
      },
    },
  } as any;
}

function buildState(
  room: ReturnType<typeof makeRoomEntry>,
  user = makeUser(),
  selectedGameId?: number,
  roomsOverrides: Partial<{ joinGamePending: boolean; joinGameError: { code: number; message: string } | null }> = {},
) {
  return makeStoreState({
    ...connectedWithRoomsState,
    rooms: {
      rooms: { 1: room },
      joinedRoomIds: { 1: true },
      joinedGameIds: {},
      messages: { 1: [] },
      sortGamesBy: { field: GameSortField.START_TIME, order: SortDirection.DESC },
      sortUsersBy: { field: UserSortField.NAME, order: SortDirection.ASC },
      selectedGameIds: selectedGameId != null ? { 1: selectedGameId } : {},
      gameFilters: {},
      joinGamePending: false,
      joinGameError: null,
      ...roomsOverrides,
    } as any,
    server: {
      ...(connectedWithRoomsState.server as any),
      user,
    } as any,
  });
}

beforeEach(() => {
  mockUseWebClient.mockReset();
  mockNavigate.mockReset();
});

const { IsRegistered, IsModerator, IsJudge } = ServerInfo_User_UserLevelFlag;
describe('GamesList restriction gating', () => {
  it.each([
    ['ordinary', IsRegistered, false, false],
    ['locked ordinary', IsRegistered, true, false],
    ['moderator', IsModerator, false, true],
    ['locked moderator', IsModerator, true, false],
    ['judge', IsJudge, false, true],
    ['locked judge', IsJudge, true, true],
  ] as const)('gates a full private game for %s', (_name, userLevel, locked, override) => {
    setAdminLocked(locked);
    const client = makeWebClient();
    mockUseWebClient.mockReturnValue(client);
    const room = makeRoomEntry([makeGame({ playerCount: 4, spectatorsAllowed: false, withPassword: true,
      spectatorsNeedPassword: true })]);
    renderWithProviders(<GamesList room={room} />, { preloadedState: buildState(room, makeUser({ userLevel }), 1) });
    const join = screen.getByRole('button', { name: /^GameRow\.join/ });
    const spectate = screen.getByRole('button', { name: /^GameRow\.spectate/ });
    expect(join).toHaveProperty('disabled', !override);
    expect(spectate).toHaveProperty('disabled', !override);
    if (override) {
      fireEvent.click(join);
      expect(client.request.rooms.joinGame).toHaveBeenCalledWith(1, expect.objectContaining({
        overrideRestrictions: true, password: '', spectator: true,
      }), expect.any(String));
      expect(screen.queryByRole('dialog', { name: 'PasswordPopover.label' })).not.toBeInTheDocument();
    }
  });
});
