import { act } from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { create, type MessageInitShape } from '@bufbuild/protobuf';

import { ServerInfo_GameSchema, ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import { rooms as roomsSlice, type Room } from '@cockatrice/datatrice';
import { SeatDots, VirtualRows } from '@app/components';

vi.mock('@app/components', async (original) => {
  const components = await original<typeof import('@app/components')>();
  return { ...components, SeatDots: vi.fn(components.SeatDots), VirtualRows: vi.fn(components.VirtualRows) };
});

import { connectedWithRoomsState, createMockWebClient, makeUser, renderWithProviders } from '../../../__test-utils__';
import type { RootState } from '../../../store';
import GamesList from './GamesList';

type RoCallback = (entries: { contentRect: { height: number; width: number }; target: Element }[]) => void;
interface RoHandle { callback: RoCallback; targets: Set<Element> }
let observers: RoHandle[] = [];

function mountRows(container: HTMLElement): void {
  const list = container.querySelector('.virtual-list__list');
  if (!list) {
    return;
  }
  for (const handle of observers) {
    if (handle.targets.has(list)) {
      act(() => {
        handle.callback([{ contentRect: { height: 400, width: 800 }, target: list }]);
      });
    }
  }
}

const makeGame = (
  gameId: number,
  description: string,
  playerCount = 1,
  spectatorsAllowed = true,
  extra: MessageInitShape<typeof ServerInfo_GameSchema> = {},
) => ({
  info: create(ServerInfo_GameSchema, {
    gameId, roomId: 1, description, playerCount, maxPlayers: 2, spectatorsAllowed, startTime: gameId, ...extra,
  }),
  gameType: '',
});

const GAMES = { 1: makeGame(1, 'Alpha'), 2: makeGame(2, 'Bravo'), 3: makeGame(3, 'Charlie') };

interface SetupOptions {
  games?: Record<number, ReturnType<typeof makeGame>>;
  rooms?: Partial<RootState['rooms']>;
  userLevel?: number;
}

function setup({ games = GAMES, rooms: roomsOverrides = {}, userLevel }: SetupOptions = {}) {
  const rooms = connectedWithRoomsState.rooms!;
  const preloadedState: Partial<RootState> = {
    ...connectedWithRoomsState,
    rooms: { ...rooms, rooms: { 1: { ...rooms.rooms[1], games } }, ...roomsOverrides },
    ...(userLevel != null && {
      server: { ...connectedWithRoomsState.server!, user: makeUser({ name: 'me', userLevel }) },
    }),
  };
  const room = preloadedState.rooms!.rooms[1] as Room;
  const webClient = createMockWebClient();
  const view = renderWithProviders(<GamesList room={room} />, { preloadedState, webClient, route: '/room/1' });
  mountRows(view.container);
  return { ...view, webClient };
}

const row = (description: string) => screen.getByRole('row', { name: new RegExp(description) });

describe('GamesList', () => {
  it('asks before a full-game row joins as spectator, with No focused', () => {
    const { webClient } = setup({ games: { 1: makeGame(1, 'Full game', 2) } });
    fireEvent.doubleClick(row('Full game'));
    expect(screen.getByRole('button', { name: 'GameLink.no' })).toHaveFocus();
    expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'GameLink.yes' }));
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(1, expect.objectContaining({ spectator: true }), expect.any(String));
  });

  let originalRo: typeof globalThis.ResizeObserver;

  beforeEach(() => {
    originalRo = globalThis.ResizeObserver;
    observers = [];
    globalThis.ResizeObserver = class {
      private handle: RoHandle;
      constructor(callback: RoCallback) {
        this.handle = { callback, targets: new Set() };
        observers.push(this.handle);
      }
      observe(target: Element) {
        this.handle.targets.add(target);
      }
      unobserve(target: Element) {
        this.handle.targets.delete(target);
      }
      disconnect() {
        this.handle.targets.clear();
      }
    } as unknown as typeof globalThis.ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalRo;
  });

  it('is a grid with one tab stop, on the first row until a game is selected', () => {
    setup();

    const grid = screen.getByRole('grid', { name: 'GamesList.heading' });
    const rows = within(grid).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    expect(rows.map((r) => r.getAttribute('aria-rowindex'))).toEqual(['2', '3', '4']);
    expect(grid).toHaveAttribute('aria-rowcount', '4');
  });

  it('moves the selection and focus with the arrow keys', () => {
    setup();
    const [first, second] = screen.getAllByRole('row').slice(1);
    expect(first).toHaveAccessibleName(/Charlie/);

    fireEvent.keyDown(first, { key: 'ArrowDown' });

    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(second).toHaveFocus();
  });

  it('joins the focused game on Enter, without a prior click', () => {
    const { webClient } = setup();

    fireEvent.keyDown(row('Alpha'), { key: 'Enter' });

    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(
      1, expect.objectContaining({ gameId: 1, spectator: false }), expect.any(String),
    );
  });

  it('joins on double-click like desktop', () => {
    const { webClient } = setup();

    fireEvent.doubleClick(row('Charlie'));

    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(1, expect.objectContaining({ gameId: 3 }), expect.any(String));
  });

  it('does not redraw virtual rows when opening the More filters panel', () => {
    setup();
    const renderRow = vi.mocked(VirtualRows).mock.calls.at(-1)![0].renderRow;
    fireEvent.click(screen.getByRole('button', { name: 'QuickFilterBar.more' }));
    expect(screen.getByRole('dialog', { name: 'QuickFilterBar.more' })).toBeInTheDocument();
    expect(vi.mocked(VirtualRows).mock.calls.at(-1)![0].renderRow).toBe(renderRow);
  });

  it('redraws only the changed game row when a game update arrives', () => {
    const { store } = setup();
    vi.mocked(SeatDots).mockClear();

    act(() => {
      store.dispatch(roomsSlice.Actions.updateGames({
        roomId: 1,
        games: [makeGame(1, 'Alpha', 2).info],
      }));
    });

    expect(SeatDots).toHaveBeenCalledTimes(1);
  });

  it('keeps keyboard focus on the same game when a newer game is inserted above it', () => {
    const { store, webClient } = setup();
    row('Bravo').focus();
    act(() => {
      store.dispatch(roomsSlice.Actions.updateGames({ roomId: 1, games: [makeGame(4, 'Delta').info] }));
    });
    expect(row('Bravo')).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(1, expect.objectContaining({ gameId: 2 }), expect.any(String));
  });

  it('sorts from the sort menu and reports the direction on the game column', () => {
    const { store } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'QuickFilterBar.sort.label' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'QuickFilterBar.sort.description' }));

    expect(store.getState().rooms.sortGamesBy).toEqual({ field: 'info.description', order: 'ASC' });
    expect(screen.getAllByRole('row').slice(1).map((r) => r.textContent)).toEqual([
      expect.stringContaining('Alpha'), expect.stringContaining('Bravo'), expect.stringContaining('Charlie'),
    ]);
    expect(screen.getByRole('columnheader', { name: /GamesList\.column\.game/ })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('shows the game age in minutes rather than the raw start time', () => {
    const startTime = Math.floor(Date.now() / 1000) - 5 * 60;
    setup({ games: { 1: makeGame(1, 'Fresh', 1, true, { startTime }) } });

    expect(row('Fresh')).toHaveTextContent('GameRow.age.minutes');
    expect(row('Fresh')).not.toHaveTextContent(String(startTime));
  });

  describe('row actions', () => {
    const join = (name: RegExp = /^GameRow\.join$/) => screen.getByRole('button', { name });
    const spectate = () => screen.getByRole('button', { name: /^GameRow\.spectate/ });
    const locked = () => ({ 1: makeGame(1, 'Locked', 1, true, { withPassword: true }) });

    it('joins and spectates straight from the row', () => {
      const { webClient } = setup({ games: { 1: makeGame(1, 'Alpha') } });

      fireEvent.click(spectate());
      expect(webClient.request.rooms.joinGame).toHaveBeenLastCalledWith(
        1, expect.objectContaining({ gameId: 1, spectator: true }), expect.any(String),
      );
      fireEvent.click(join());
      expect(webClient.request.rooms.joinGame).toHaveBeenLastCalledWith(
        1, expect.objectContaining({ gameId: 1, spectator: false }), expect.any(String),
      );
    });

    it('disables Join and Spectate while a join is pending', () => {
      setup({ games: { 1: makeGame(1, 'Alpha') }, rooms: { joinGamePending: true } });

      expect(join(/^GameRow\.joinBlocked/)).toBeDisabled();
      expect(spectate()).toBeDisabled();
    });

    it('disables Join with a reason when the game is full', () => {
      setup({ games: { 1: makeGame(1, 'Full', 2) } });

      expect(join(/^GameRow\.joinBlocked/)).toBeDisabled();
      expect(spectate()).toBeEnabled();
    });

    it('disables Spectate when the game allows no spectators', () => {
      setup({ games: { 1: makeGame(1, 'Closed', 1, false) } });

      expect(spectate()).toBeDisabled();
      expect(join()).toBeEnabled();
    });

    it('asks for the password in a popover under Join and sends it', () => {
      const { webClient } = setup({ games: locked() });

      fireEvent.click(join(/^GameRow\.joinWithPassword/));
      const popover = screen.getByRole('dialog', { name: 'PasswordPopover.label' });
      const field = within(popover).getByLabelText('PasswordPopover.label');
      expect(field).toHaveAttribute('type', 'password');
      expect(field).toHaveFocus();
      fireEvent.change(field, { target: { value: 'hunter2' } });
      fireEvent.click(within(popover).getByRole('button', { name: 'Common.action.join' }));

      expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(
        1, expect.objectContaining({ gameId: 1, password: 'hunter2' }), expect.any(String),
      );
      expect(screen.queryByRole('dialog', { name: 'PasswordPopover.label' })).not.toBeInTheDocument();
    });

    it('keeps the password popover open and returns focus to Join when the list changes under it', () => {
      const { store } = setup({ games: locked() });

      fireEvent.click(join(/^GameRow\.joinWithPassword/));
      act(() => {
        store.dispatch(roomsSlice.Actions.updateGames({ roomId: 1, games: [makeGame(4, 'Delta').info] }));
      });
      const popover = screen.getByRole('dialog', { name: 'PasswordPopover.label' });
      fireEvent.keyDown(within(popover).getByLabelText('PasswordPopover.label'), { key: 'Escape' });

      expect(screen.queryByRole('dialog', { name: 'PasswordPopover.label' })).not.toBeInTheDocument();
      expect(join(/^GameRow\.joinWithPassword/)).toHaveFocus();
    });

    it('returns focus to the games grid when the password popover closes after its row scrolled out of view', () => {
      const many = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [i + 2, makeGame(i + 2, `Open ${i + 2}`)]));
      const newest = makeGame(1, 'Locked', 1, true, { withPassword: true, startTime: 1000 });
      const { container } = setup({ games: { 1: newest, ...many } });
      const lockedRow = row('Locked');
      fireEvent.click(within(lockedRow).getByRole('button', { name: /^GameRow\.joinWithPassword/ }));
      const list = container.querySelector<HTMLElement>('.virtual-list__list')!;

      act(() => {
        list.scrollTop = 40 * 60;
        fireEvent.scroll(list);
      });
      expect(lockedRow).not.toBeInTheDocument();
      const popover = screen.getByRole('dialog', { name: 'PasswordPopover.label' });
      fireEvent.keyDown(within(popover).getByLabelText('PasswordPopover.label'), { key: 'Escape' });

      expect(screen.queryByRole('dialog', { name: 'PasswordPopover.label' })).not.toBeInTheDocument();
      expect(screen.getByRole('grid')).toHaveFocus();
    });

    it('closes the password popover on Escape without joining', () => {
      const { webClient } = setup({ games: locked() });

      fireEvent.click(join(/^GameRow\.joinWithPassword/));
      const popover = screen.getByRole('dialog', { name: 'PasswordPopover.label' });
      fireEvent.keyDown(within(popover).getByLabelText('PasswordPopover.label'), { key: 'Escape' });

      expect(screen.queryByRole('dialog', { name: 'PasswordPopover.label' })).not.toBeInTheDocument();
      expect(webClient.request.rooms.joinGame).not.toHaveBeenCalled();
    });

    it('offers game info and the game link in the More menu, without judge items for non-judges', () => {
      setup({ games: { 1: makeGame(1, 'Alpha') }, userLevel: ServerInfo_User_UserLevelFlag.IsUser });

      fireEvent.click(screen.getByRole('button', { name: 'GameRow.more' }));

      expect(screen.getByRole('menuitem', { name: /GamesList\.action\.copyLink/ })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /GamesList\.action\.judge/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('menuitem', { name: 'GamesList.action.info' }));
      expect(screen.getByRole('dialog', { name: 'Alpha' })).toBeInTheDocument();
    });

    it('lets a judge spectate as judge from the More menu', () => {
      const { webClient } = setup({
        games: { 1: makeGame(1, 'Alpha') },
        userLevel: ServerInfo_User_UserLevelFlag.IsUser | ServerInfo_User_UserLevelFlag.IsJudge,
      });

      fireEvent.click(screen.getByRole('button', { name: 'GameRow.more' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'GamesList.action.judgeSpectate' }));

      expect(webClient.request.rooms.joinGame).toHaveBeenCalledWith(
        1, expect.objectContaining({ gameId: 1, spectator: true, joinAsJudge: true }), expect.any(String),
      );
    });
  });

  describe('quick filters', () => {
    it('filters by description as you type and shows an honest count', () => {
      const { store } = setup();

      fireEvent.change(screen.getByRole('searchbox', { name: 'QuickFilterBar.search' }), { target: { value: 'brav' } });

      expect(store.getState().rooms.gameFilters[1]?.gameNameFilter).toBe('brav');
      expect(screen.getAllByRole('row').slice(1)).toHaveLength(1);
      expect(screen.getByText('QuickFilterBar.count')).toBeInTheDocument();
    });

    it('hides full and started games with one toggle', () => {
      const { store } = setup();

      fireEvent.click(screen.getByRole('button', { name: 'QuickFilterBar.hideFullAndStarted' }));

      expect(store.getState().rooms.gameFilters[1]).toMatchObject({ hideFullGames: true, hideGamesThatStarted: true });
      expect(screen.getByRole('button', { name: 'QuickFilterBar.hideFullAndStarted' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('applies More filters live and lists them as removable chips', () => {
      const { store } = setup();

      fireEvent.click(screen.getByRole('button', { name: 'QuickFilterBar.more' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'MoreFilters.hide.ignoredUsers' }));
      expect(store.getState().rooms.gameFilters[1]?.hideIgnoredUserGames).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'MoreFilters.done' }));
      fireEvent.click(screen.getByRole('button', { name: 'QuickFilterBar.removeChip' }));

      expect(store.getState().rooms.gameFilters[1]?.hideIgnoredUserGames).toBe(false);
    });

    it('clears every filter from Clear all', () => {
      const { store } = setup({
        rooms: { gameFilters: { 1: { ...roomsSlice.DEFAULT_GAME_FILTERS, hideFullGames: true, gameNameFilter: 'x' } } },
      });

      fireEvent.click(screen.getAllByRole('button', { name: 'QuickFilterBar.clearAll' })[0]);

      expect(store.getState().rooms.gameFilters[1]).toEqual(roomsSlice.DEFAULT_GAME_FILTERS);
    });

    it('says when filters hide every game', () => {
      setup({ rooms: { gameFilters: { 1: { ...roomsSlice.DEFAULT_GAME_FILTERS, gameNameFilter: 'zzz' } } } });

      expect(screen.getByText('GamesList.emptyFiltered')).toBeInTheDocument();
    });
  });
});
