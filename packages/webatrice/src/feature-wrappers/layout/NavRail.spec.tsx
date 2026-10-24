import { act, fireEvent, screen, within } from '@testing-library/react';
import { useLocation } from 'react-router-dom';

import { rooms, server } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag as Level } from '@cockatrice/sockatrice/generated';
import { connectedState, connectedWithRoomsState, makeUser, renderWithProviders } from '../../__test-utils__';
import { PlayBadgeMode, PREFERENCE_DEFAULTS, RouteEnum } from '@app/types';

import { settingsStore } from '../../hooks/useSettings';
import NavRail from './NavRail';

interface Counts {
  rooms: Record<number, number>;
  games: Record<number, number>;
  chats: Record<string, number>;
  mentions: { rooms: Record<number, number>; games: Record<number, number> };
  notifications: number;
  total: number;
}

const NOTHING_UNREAD: Counts = {
  rooms: {}, games: {}, chats: {}, mentions: { rooms: {}, games: {} }, notifications: 0, total: 0,
};

const unread = vi.hoisted(() => ({ counts: null as unknown as Counts }));

vi.mock('@app/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/hooks')>()),
  useUnreadCounts: () => unread.counts,
}));

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function stateFor(userLevel: number, version: string) {
  return {
    ...connectedState,
    server: {
      ...(connectedState.server as any),
      info: { message: null, name: 'Servatrice', version },
      user: makeUser({ userLevel }),
    },
  };
}

function renderRail(route: string = RouteEnum.SERVER, preloadedState: object = connectedState) {
  return renderWithProviders(<><NavRail /><LocationProbe /></>, { preloadedState, route });
}

const REGISTERED = Level.IsUser | Level.IsRegistered;
const MODERATOR = REGISTERED | Level.IsModerator;
const staffLink = () => within(places()).queryByRole('link', { name: 'NavRail.place.staff' });

const places = () => screen.getByRole('navigation', { name: 'NavRail.label' });

describe('NavRail', () => {
  beforeEach(() => {
    unread.counts = NOTHING_UNREAD;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('links every place, in rail order', () => {
    renderRail();

    expect(within(places()).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      RouteEnum.SERVER, RouteEnum.DECKS, RouteEnum.REPLAYS, RouteEnum.PEOPLE, RouteEnum.SETTINGS,
    ]);
  });

  it('marks the place the current page belongs to', () => {
    renderRail('/game/4');

    expect(screen.getByRole('link', { name: 'NavRail.place.play' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'NavRail.place.decks' })).not.toHaveAttribute('aria-current');
  });

  it('shows no Staff place to a regular user or a judge', () => {
    renderRail(RouteEnum.SERVER, stateFor(REGISTERED | Level.IsJudge, '3.1.0 ()'));

    expect(staffLink()).not.toBeInTheDocument();
  });

  it('puts Staff before Settings for a moderator, opening the first tool the server serves', () => {
    renderRail(RouteEnum.SERVER, stateFor(MODERATOR, '3.1.0 ()'));

    expect(within(places()).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      RouteEnum.SERVER, RouteEnum.DECKS, RouteEnum.REPLAYS, RouteEnum.PEOPLE, RouteEnum.REPORT_QUEUE, RouteEnum.SETTINGS,
    ]);
  });

  it('opens Moderation from Staff on a 3.0 server, where the report queue does not exist', () => {
    renderRail(RouteEnum.SERVER, stateFor(MODERATOR, '3.0.0 ()'));

    fireEvent.click(staffLink()!);

    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.MODERATION);
  });

  it('gives a developer Staff on a server with the developer role', () => {
    renderRail(RouteEnum.SERVER, stateFor(REGISTERED | Level.IsDeveloper, '3.1.0 ()'));

    expect(staffLink()).toHaveAttribute('href', RouteEnum.LOGS);
  });

  it.each([RouteEnum.REPORT_QUEUE, RouteEnum.MODERATION, RouteEnum.LOGS, RouteEnum.ADMINISTRATION, RouteEnum.CARD_ART_RULES])(
    'lights Staff on %s',
    (route) => {
      renderRail(route, stateFor(MODERATOR, '3.1.0 ()'));

      expect(staffLink()).toHaveAttribute('aria-current', 'page');
    },
  );

  it('adds and removes Staff when the signed-in user level changes, without a reload', () => {
    const { store } = renderRail(RouteEnum.SERVER, stateFor(REGISTERED, '3.0.0 ()'));
    expect(staffLink()).not.toBeInTheDocument();

    act(() => {
      store.dispatch(server.Actions.updateUser({ user: { userLevel: MODERATOR } }));
    });
    expect(staffLink()).toBeInTheDocument();

    act(() => {
      store.dispatch(server.Actions.updateUser({ user: { userLevel: REGISTERED } }));
    });
    expect(staffLink()).not.toBeInTheDocument();
  });

  it('navigates from a place', () => {
    renderRail();

    fireEvent.click(screen.getByRole('link', { name: 'NavRail.place.people' }));

    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.PEOPLE);
  });

  it('badges Play with mentions only and People with unread chats by default', () => {
    unread.counts = {
      ...NOTHING_UNREAD, rooms: { 1: 2 }, games: { 3: 5 }, chats: { bob: 4 }, mentions: { rooms: { 1: 1 }, games: {} },
    };
    renderRail();

    expect(screen.getByRole('link', { name: /NavRail\.place\.play/ })).toHaveTextContent('1');
    expect(screen.getByRole('link', { name: /NavRail\.place\.people/ })).toHaveTextContent('4');
    expect(screen.getByRole('link', { name: 'NavRail.place.decks' })).not.toHaveTextContent(/\d/);
  });

  it('badges Play with all room and game activity when the setting asks for it', () => {
    vi.spyOn(settingsStore, 'peek').mockReturnValue({ ...PREFERENCE_DEFAULTS, playBadge: PlayBadgeMode.All } as never);
    unread.counts = { ...NOTHING_UNREAD, rooms: { 1: 2 }, games: { 3: 1 }, mentions: { rooms: { 1: 1 }, games: {} } };
    renderRail();

    expect(screen.getByRole('link', { name: /NavRail\.place\.play/ })).toHaveTextContent('3');
  });

  it('shows no Play badge for activity without mentions by default', () => {
    unread.counts = { ...NOTHING_UNREAD, rooms: { 1: 9 }, games: { 3: 9 } };
    renderRail();

    expect(screen.getByRole('link', { name: 'NavRail.place.play' })).not.toHaveTextContent(/\d/);
  });

  it('hides itself to a strip with a show button, keeping focus on the toggle, and comes back', () => {
    renderRail();
    const toggle = screen.getByRole('button', { name: 'NavRail.toggle.hide' });
    toggle.focus();

    fireEvent.click(toggle);

    expect(screen.queryByRole('navigation', { name: 'NavRail.label' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'testUser' })).not.toBeInTheDocument();
    const show = screen.getByRole('button', { name: 'NavRail.toggle.show' });
    expect(show).toHaveFocus();
    expect(window.localStorage.getItem('webatrice.navRailHidden')).toBe('true');

    fireEvent.click(show);

    expect(places()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'NavRail.toggle.hide' })).toHaveFocus();
  });

  it('shows no badge with nothing unread', () => {
    renderRail();

    expect(screen.getByRole('link', { name: 'NavRail.place.play' })).not.toHaveTextContent(/\d/);
  });

  it('opens the account menu from the avatar and reaches Shortcuts', () => {
    renderRail();

    fireEvent.click(screen.getByRole('button', { name: 'testUser' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'UserMenu.shortcuts' }));

    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.SHORTCUTS);
  });

  it('goes home from the logo, which Play does not light', () => {
    renderRail(RouteEnum.DECKS, connectedWithRoomsState);

    fireEvent.click(screen.getByRole('link', { name: 'NavRail.home' }));

    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.SERVER);
    expect(screen.getByRole('link', { name: 'NavRail.home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'NavRail.place.play' })).not.toHaveAttribute('aria-current');
  });

  describe('Play', () => {
    const fixture = connectedWithRoomsState.rooms as any;
    const twoRooms = {
      ...connectedWithRoomsState,
      rooms: {
        ...fixture,
        rooms: { ...fixture.rooms, 2: { ...fixture.rooms[1], info: { ...fixture.rooms[1].info, roomId: 2, name: 'Second' } } },
        joinedRoomIds: { 1: true, 2: true },
      },
    };
    const play = () => screen.getByRole('link', { name: 'NavRail.place.play' });

    it('opens Home with no room joined', () => {
      renderRail(RouteEnum.DECKS);

      expect(play()).toHaveAttribute('href', RouteEnum.SERVER);
    });

    it('opens a joined room when none was visited', () => {
      renderRail(RouteEnum.DECKS, connectedWithRoomsState);

      fireEvent.click(play());

      expect(screen.getByTestId('location')).toHaveTextContent('/room/1');
    });

    it('returns to the room visited last, after a reload too', () => {
      renderRail('/room/2', twoRooms).unmount();
      renderRail(RouteEnum.DECKS, twoRooms);

      fireEvent.click(play());

      expect(screen.getByTestId('location')).toHaveTextContent('/room/2');
    });

    it('ignores a room visited by another account', () => {
      const asBob = { ...twoRooms, server: { ...(twoRooms.server as any), user: makeUser({ name: 'bob' }) } };
      renderRail('/room/2', asBob).unmount();
      renderRail(RouteEnum.DECKS, twoRooms);

      expect(play()).toHaveAttribute('href', '/room/1');
    });

    it('falls back to another joined room once the last room is left', () => {
      const { store } = renderRail('/room/2', twoRooms);

      act(() => {
        store.dispatch(rooms.Actions.leaveRoom({ roomId: 2 }));
      });

      expect(play()).toHaveAttribute('href', '/room/1');
    });
  });
});
