import { act, fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { rooms } from '@cockatrice/datatrice';
import { Event_RoomSay_RoomMessageType } from '@cockatrice/sockatrice/generated';

import { connectedWithRoomsState, renderWithProviders } from '../../__test-utils__';
import NotificationBell from './NotificationBell';
import NotificationCentre from './NotificationCentre';
import { logNotification, notificationStore } from '../../services/notifications/notificationStore';

function renderCentre(route = '/') {
  return renderWithProviders(
    <>
      <NotificationBell />
      <NotificationCentre />
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/room/:roomId" element={<p>room page</p>} />
        <Route path="/game/:gameId" element={<p>game page</p>} />
        <Route path="/player/:name" element={<p>chat page</p>} />
        <Route path="/settings" element={<p>settings page</p>} />
      </Routes>
    </>,
    { preloadedState: connectedWithRoomsState, route },
  );
}

const bell = () => screen.getByRole('button', { name: /^NotificationCentre\.bell/ });
const drawer = () => screen.getByRole('complementary', { name: 'NotificationCentre.drawer.title' });

describe('NotificationBell and NotificationCentre', () => {
  beforeEach(() => {
    notificationStore.reset();
  });

  it('counts unread entries on the bell and opens the session log from it', () => {
    renderCentre();
    expect(bell()).toHaveAccessibleName('NotificationCentre.bell.label');
    act(() => {
      logNotification({ kind: 'message', actor: 'bob', body: 'hi', target: { type: 'chat', userName: 'bob' } });
      logNotification({ kind: 'game', place: 'Pod', seats: { taken: 4, max: 4 }, target: { type: 'game', gameId: 7 } }, true);
    });
    expect(bell()).toHaveAccessibleName('NotificationCentre.bell.labelUnread');
    expect(bell().parentElement).toHaveTextContent('1');

    fireEvent.click(bell());

    expect(bell()).toHaveAttribute('aria-expanded', 'true');
    const panel = within(drawer());
    expect(panel.getByRole('region', { name: 'NotificationCentre.drawer.sectionNew' })).toHaveTextContent('bob');
    expect(panel.getByRole('region', { name: 'NotificationCentre.drawer.sectionEarlier' })).toHaveTextContent('Notifications.title.game');
  });

  it('filters by kind and runs one action per entry, marking it read and closing the drawer', () => {
    renderCentre();
    act(() => {
      logNotification({ kind: 'message', actor: 'bob', body: 'hi', target: { type: 'chat', userName: 'bob' } });
      logNotification({ kind: 'mention', actor: 'amy', place: 'Magic', target: { type: 'room', roomId: 1 } });
    });
    fireEvent.click(bell());

    fireEvent.click(within(drawer()).getByRole('button', { name: /NotificationCentre\.filter\.mention/ }));
    expect(within(drawer()).queryByText('bob')).not.toBeInTheDocument();

    fireEvent.click(within(drawer()).getByRole('button', { name: 'Notifications.action.mention' }));

    expect(screen.getByText('room page')).toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(notificationStore.getState().entries.map((entry) => entry.read)).toEqual([true, false]);
  });

  it('marks everything read and closes on Escape', () => {
    renderCentre();
    act(() => {
      logNotification({ kind: 'report', title: 'Report resolved', target: { type: 'route', path: '/settings' } });
    });
    fireEvent.click(bell());

    fireEvent.click(within(drawer()).getByRole('button', { name: 'NotificationCentre.drawer.markAllRead' }));
    expect(bell()).toHaveAccessibleName('NotificationCentre.bell.label');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('shows an empty state and links to the notification settings', () => {
    renderCentre();
    fireEvent.click(bell());
    expect(within(drawer()).getByText('NotificationCentre.drawer.empty')).toBeInTheDocument();

    fireEvent.click(within(drawer()).getByRole('button', { name: 'NotificationCentre.drawer.settings' }));
    expect(screen.getByText('settings page')).toBeInTheDocument();
  });

  it('counts unread room lines while elsewhere and clears them when the room is shown', () => {
    const { store } = renderCentre();
    act(() => {
      store.dispatch(rooms.Actions.addMessage({
        roomId: 1,
        message: { name: 'otherUser', message: 'hello', messageType: Event_RoomSay_RoomMessageType.UserMessage, timeReceived: 0 } as never,
      }));
    });
    expect(notificationStore.getState().rooms).toEqual({ 1: 1 });

    act(() => {
      logNotification({ kind: 'mention', actor: 'amy', target: { type: 'room', roomId: 1 } });
    });
    fireEvent.click(bell());
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Notifications.action.mention' }));

    expect(notificationStore.getState().rooms).toEqual({});
  });

  it('counts a room line that arrives while the window is unfocused and clears it on refocus', () => {
    const focus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const { store } = renderCentre('/room/1');
    act(() => {
      store.dispatch(rooms.Actions.addMessage({
        roomId: 1,
        message: { name: 'otherUser', message: 'hello', messageType: Event_RoomSay_RoomMessageType.UserMessage, timeReceived: 0 } as never,
      }));
      logNotification({ kind: 'mention', actor: 'otherUser', target: { type: 'room', roomId: 1 } });
    });
    expect(notificationStore.getState().rooms).toEqual({ 1: 1 });

    focus.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(notificationStore.getState().rooms).toEqual({});
    expect(notificationStore.getState().entries[0].read).toBe(true);
    focus.mockRestore();
  });
});
