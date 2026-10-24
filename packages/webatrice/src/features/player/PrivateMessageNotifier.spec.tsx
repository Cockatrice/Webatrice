import { act, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { server } from '@cockatrice/datatrice';
import { Event_UserMessageSchema } from '@cockatrice/sockatrice/generated';

import { connectedState, makeUser, renderWithProviders } from '../../__test-utils__';
import { playSound } from '../../hooks/playSound';
import { getSettings, settingsStore } from '../../hooks/useSettings';
import PrivateMessageNotifier from './PrivateMessageNotifier';
import { logNotification, notificationStore } from '../../services/notifications/notificationStore';
import { endSession } from '../../services/session';
import { dispatchChatDock } from '../../hooks/useChatDock';
import { ChatDock } from '../../feature-widgets/chat-dock';
import { chatFilterVerdicts } from '../../utils/chatFilters';

vi.mock('../../hooks/playSound');

class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static instances: FakeNotification[] = [];
  onclick: (() => void) | null = null;
  close = vi.fn();
  constructor(public title: string, public options: NotificationOptions) {
    FakeNotification.instances.push(this);
  }
}

const state = {
  ...connectedState,
  server: {
    ...connectedState.server!,
    user: makeUser({ name: 'me' }),
    users: { alice: makeUser({ name: 'alice', userLevel: 3 }) },
    messages: { alice: [Object.assign(
      create(Event_UserMessageSchema, { senderName: 'alice', receiverName: 'me', message: 'old' }), { timeReceived: 0 },
    )] },
  },
};

const receive = async (store: { dispatch: (action: unknown) => unknown }, senderName: string, message: string) =>
  act(() => {
    store.dispatch(server.Actions.userMessage({
      timeReceived: 123,
      messageData: create(Event_UserMessageSchema, { senderName, receiverName: 'me', message }),
    }));
  });

const renderNotifier = (route = '/') => renderWithProviders(<PrivateMessageNotifier />, { preloadedState: state, route });

describe('PrivateMessageNotifier', () => {
  beforeEach(async () => {
    notificationStore.reset();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    FakeNotification.instances = [];
    vi.stubGlobal('Notification', FakeNotification);
    settingsStore.reset();
    await getSettings();
  });

  it.each([
    { level: 1, preferences: { ignoreUnregisteredUserMessages: true }, visible: false },
    { level: 7, preferences: { ignoreAllPrivateMessages: true }, visible: true },
  ])('pins the ingress verdict before a batched departure: $visible', async ({ level, preferences, visible }) => {
    const settings = await getSettings();
    Object.assign(settings, preferences);
    settingsStore.setValue(settings);
    const { store } = renderWithProviders(<PrivateMessageNotifier />, {
      preloadedState: {
        ...state,
        server: { ...state.server, messages: {}, users: { alice: makeUser({ name: 'alice', userLevel: level }) } },
      },
    });
    act(() => {
      store.dispatch(server.Actions.userMessage({ timeReceived: 123, messageData: create(Event_UserMessageSchema, {
        senderName: 'alice', receiverName: 'me', message: 'arrival',
      }) }));
      const stored = store.getState().server.messages.alice[0];
      expect(chatFilterVerdicts.get(stored)).toBe(visible);
      store.dispatch(server.Actions.userLeft({ name: 'alice' }));
    });
    expect(Boolean(screen.queryByText('arrival'))).toBe(visible);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('toasts and plays the private-message sound for a new message, not for history', async () => {
    const { store } = renderNotifier();
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();

    await receive(store, 'alice', 'hello there');

    expect(screen.getByTestId('toast')).toHaveTextContent('Notifications.toastTitle');
    expect(notificationStore.getState().entries[0]).toMatchObject({ kind: 'message', actor: 'alice', read: false });
    expect(screen.getByText('hello there')).toBeInTheDocument();
    expect(playSound).toHaveBeenCalledWith('private_message');
  });

  it('stays quiet for your own echoed message', () => {
    const { store } = renderNotifier();
    act(() => {
      store.dispatch(server.Actions.userMessage({
        timeReceived: 123,
        messageData: create(Event_UserMessageSchema, { senderName: 'me', receiverName: 'alice', message: 'mine' }),
      }));
    });
    expect(screen.queryByText('mine')).not.toBeInTheDocument();
    expect(playSound).not.toHaveBeenCalled();
  });

  it('stays quiet while you are reading that conversation', async () => {
    const { store } = renderNotifier('/player/alice');
    await receive(store, 'alice', 'hello there');

    expect(screen.queryByText('hello there')).not.toBeInTheDocument();
    expect(playSound).not.toHaveBeenCalled();
  });

  it('uses an OS notification instead of a toast while the tab is hidden', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { store } = renderNotifier();

    await receive(store, 'alice', 'are you there?');

    expect(FakeNotification.instances).toHaveLength(1);
    expect(FakeNotification.instances[0].options).toMatchObject({ body: 'are you there?', tag: 'pm:alice' });
    expect(screen.queryByText('are you there?')).not.toBeInTheDocument();
  });

  it('notifies for the open conversation when the visible window loses focus', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const { store } = renderNotifier('/player/alice');
    await receive(store, 'alice', 'window is inactive');
    expect(FakeNotification.instances[0]?.options.body).toBe('window is inactive');
  });

  it('falls back to the toast when desktop notifications for private messages are off', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const settings = await getSettings();
    settings.showMessagePopups = false;
    settingsStore.setValue(settings);
    const { store } = renderNotifier();

    await receive(store, 'alice', 'are you there?');

    expect(FakeNotification.instances).toHaveLength(0);
    expect(screen.getByText('are you there?')).toBeInTheDocument();
  });

  it('skips the toast and sound for a chat open in the dock, logging it as read', async () => {
    dispatchChatDock({ type: 'open', name: 'alice', max: 3 });
    try {
      const { store } = renderWithProviders(<><PrivateMessageNotifier /><ChatDock /></>, { preloadedState: state });

      await receive(store, 'alice', 'seen in the dock');

      expect(screen.getByText('seen in the dock')).toBeInTheDocument();
      expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
      expect(playSound).not.toHaveBeenCalled();
      expect(notificationStore.getState().entries[0]).toMatchObject({ actor: 'alice', read: true });
    } finally {
      dispatchChatDock({ type: 'reset' });
    }
  });

  it('takes its toast down when the session ends', async () => {
    const { store } = renderNotifier();
    await receive(store, 'alice', 'private words');
    expect(screen.getByTestId('toast')).toBeInTheDocument();

    act(() => endSession());

    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    expect(notificationStore.getState().entries).toHaveLength(0);
  });

  it('closes its OS notification at session end and ignores a late click on it', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { store } = renderNotifier();
    await receive(store, 'alice', 'are you there?');
    const [stale] = FakeNotification.instances;

    act(() => endSession());
    const fresh = logNotification({ kind: 'report', title: 'next session', target: { type: 'route', path: '/' } });
    act(() => stale.onclick?.());

    expect(stale.close).toHaveBeenCalled();
    expect(notificationStore.getState().entries.find((entry) => entry.id === fresh)?.read).toBe(false);
  });

  it('raises nothing for a message the Chat preferences filter out', async () => {
    const settings = await getSettings();
    settings.ignoreAllPrivateMessages = true;
    settingsStore.setValue(settings);
    const { store } = renderNotifier();

    await receive(store, 'alice', 'filtered');

    expect(screen.queryByText('filtered')).not.toBeInTheDocument();
    expect(playSound).not.toHaveBeenCalled();
  });
});
