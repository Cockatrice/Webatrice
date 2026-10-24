import { act, fireEvent, screen, within } from '@testing-library/react';
import { Profiler } from 'react';
import { create } from '@bufbuild/protobuf';
import { server } from '@cockatrice/datatrice';
import { Event_UserMessageSchema } from '@cockatrice/sockatrice/generated';

import { connectedState, makeUser, renderWithProviders } from '../../__test-utils__';
import { getSettings, settingsStore } from '../../hooks/useSettings';
import { dispatchChatDock, getChatDockState } from '../../hooks/useChatDock';
import { UserGamesProvider } from '../user-games';
import ChatDock from './ChatDock';
import { measureDockSpace, placeDock, watchDockSpace } from './useChatDockController';
import { focusAfterClose } from './splitDock';
import { notificationStore } from '../../services/notifications/notificationStore';
import { getVisibleChats } from '../../hooks/useChatDock';

const marks = vi.hoisted(() => ({ markChatRead: vi.fn() }));

vi.mock('@app/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@app/hooks')>();
  return {
    ...actual,
    useMarkRead: () => ({ ...actual.useMarkRead(), markChatRead: marks.markChatRead }),
  };
});

const setVisibility = (value: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

const state = {
  ...connectedState,
  server: {
    ...connectedState.server!,
    user: makeUser({ name: 'me', userLevel: 3 }),
    users: { alice: makeUser({ name: 'alice', userLevel: 3 }), bob: makeUser({ name: 'bob', userLevel: 3 }) },
    buddyList: { alice: makeUser({ name: 'alice', userLevel: 3 }) },
    ignoreList: {},
    messages: {},
  },
};

const receive = (store: { dispatch: (action: unknown) => unknown }, senderName: string, message: string) =>
  act(() => {
    store.dispatch(server.Actions.userMessage({
      timeReceived: 123,
      messageData: create(Event_UserMessageSchema, { senderName, receiverName: 'me', message }),
    }));
  });

const open = (name: string) => act(() => dispatchChatDock({ type: 'open', name, max: 3 }));

describe('ChatDock', () => {
  beforeEach(async () => {
    settingsStore.reset();
    await getSettings();
  });

  afterEach(() => {
    act(() => dispatchChatDock({ type: 'reset' }));
    act(() => notificationStore.dispatch({ type: 'setDrawer', open: false }));
    setVisibility('visible');
    marks.markChatRead.mockClear();
    vi.restoreAllMocks();
  });

  it('renders nothing until a chat is open', () => {
    renderWithProviders(<ChatDock />, { preloadedState: state });
    expect(screen.queryByRole('region', { name: 'ChatDock.region' })).not.toBeInTheDocument();
  });

  it('ignores unrelated notification changes but renders changed chat unread counts', () => {
    const rendered = vi.fn();
    const view = renderWithProviders(<Profiler id="dock" onRender={rendered}><ChatDock /></Profiler>, { preloadedState: state });
    rendered.mockClear();
    act(() => notificationStore.dispatch({ type: 'bump', scope: 'rooms', key: 1 }));
    act(() => notificationStore.dispatch({ type: 'append', time: 0, read: false,
      entry: { kind: 'buddy', actor: 'bob', target: { type: 'chat', userName: 'bob' } },
    }));
    expect(rendered).not.toHaveBeenCalled();
    act(() => notificationStore.dispatch({ type: 'bump', scope: 'chats', key: 'alice' }));
    expect(rendered).toHaveBeenCalledTimes(1);
    view.unmount();
    notificationStore.reset();
  });

  it('opens a window with the conversation and focuses its input', () => {
    renderWithProviders(<ChatDock />, { preloadedState: state });
    open('alice');
    const window = screen.getByRole('region', { name: 'ChatDock.window' });
    expect(within(window).getByRole('log', { name: 'PrivateChat.log' })).toBeInTheDocument();
    expect(within(window).getByRole('textbox', { name: 'PrivateChat.input' })).toHaveFocus();
  });

  it('minimises a window to a bar and reopens it', () => {
    renderWithProviders(<ChatDock />, { preloadedState: state });
    open('alice');
    fireEvent.click(screen.getByRole('button', { name: 'ChatDock.minimise' }));
    expect(screen.queryByRole('region', { name: 'ChatDock.window' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ChatDock.open' }));
    expect(screen.getByRole('region', { name: 'ChatDock.window' })).toBeInTheDocument();
  });

  it('closes a window', () => {
    renderWithProviders(<ChatDock />, { preloadedState: state });
    open('alice');
    fireEvent.click(screen.getByRole('button', { name: 'ChatDock.close' }));
    expect(getChatDockState().chats).toEqual([]);
  });

  it('adds an incoming message as a bar, not a window', () => {
    const { store } = renderWithProviders(<ChatDock />, { preloadedState: state });
    receive(store, 'bob', 'hello');
    expect(getChatDockState().chats).toEqual([{ name: 'bob', expanded: false }]);
    expect(screen.getByRole('button', { name: 'ChatDock.open' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'ChatDock.window' })).not.toBeInTheDocument();
  });

  it('keeps an open window expanded when its peer writes', () => {
    const { store } = renderWithProviders(<ChatDock />, { preloadedState: state });
    open('alice');
    receive(store, 'alice', 'hi');
    expect(getChatDockState().chats).toEqual([{ name: 'alice', expanded: true }]);
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it('sends from the window', () => {
    const { webClient } = renderWithProviders(<ChatDock />, { preloadedState: state }) as unknown as {
      webClient: { request: { session: { message: ReturnType<typeof vi.fn> } } };
    };
    open('alice');
    const input = screen.getByRole('textbox', { name: 'PrivateChat.input' });
    fireEvent.change(input, { target: { value: 'gg' } });
    fireEvent.submit(input.closest('form')!);
    expect(webClient.request.session.message).toHaveBeenCalledWith('alice', 'gg');
  });

  it('shows the profile card from the header and closes it with Escape', () => {
    renderWithProviders(<ChatDock />, { preloadedState: state });
    open('alice');
    const trigger = screen.getByRole('button', { name: 'ChatDock.showProfile' });
    fireEvent.click(trigger);
    const card = screen.getByRole('dialog', { name: 'ChatDock.profile.label' });
    expect(within(card).getByRole('button', { name: 'ChatDock.profile.removeBuddy' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'ChatDock.profile.openPage' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'ChatDock.profile.label' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('offers the shared user menu entries, such as Show games, under More', () => {
    renderWithProviders(<UserGamesProvider><ChatDock /></UserGamesProvider>, { preloadedState: state });
    open('alice');
    fireEvent.click(screen.getByRole('button', { name: 'ChatDock.showProfile' }));
    fireEvent.click(screen.getByRole('button', { name: 'ChatDock.profile.more' }));
    const menu = screen.getByRole('menu', { name: 'ChatDock.profile.moreLabel' });
    expect(within(menu).getByRole('menuitem', { name: 'UserGamesDialog.menu.showGames' })).toBeInTheDocument();
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'ChatDock.profile.label' })).toBeInTheDocument();
  });

  it('keeps a draft when the window is minimised and reopened', () => {
    renderWithProviders(<ChatDock />, { preloadedState: state });
    open('alice');
    fireEvent.change(screen.getByRole('textbox', { name: 'PrivateChat.input' }), { target: { value: 'half a thought' } });
    fireEvent.click(screen.getByRole('button', { name: 'ChatDock.minimise' }));
    fireEvent.click(screen.getByRole('button', { name: 'ChatDock.open' }));
    expect(screen.getByRole('textbox', { name: 'PrivateChat.input' })).toHaveValue('half a thought');
  });

  it('keeps a draft when another chat pushes its window past the limit, and keeps open windows mounted', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1920);
    renderWithProviders(<ChatDock />, { preloadedState: state });
    open('alice');
    const input = screen.getByRole('textbox', { name: 'PrivateChat.input' });
    fireEvent.change(input, { target: { value: 'typing' } });
    act(() => dispatchChatDock({ type: 'open', name: 'bob', max: 2 }));
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('typing');
    act(() => dispatchChatDock({ type: 'open', name: 'carol', max: 1 }));
    act(() => dispatchChatDock({ type: 'open', name: 'alice', max: 1 }));
    expect(screen.getByRole('textbox', { name: 'PrivateChat.input' })).toHaveValue('typing');
  });

  it('marks a chat read only while it can be seen, and again when it comes back into view', () => {
    const { store } = renderWithProviders(<ChatDock />, { preloadedState: state });
    open('alice');
    expect(marks.markChatRead).toHaveBeenLastCalledWith('alice');
    marks.markChatRead.mockClear();

    setVisibility('hidden');
    expect(getVisibleChats()).toEqual([]);
    receive(store, 'alice', 'while away');
    expect(marks.markChatRead).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(marks.markChatRead).toHaveBeenCalledWith('alice');
    marks.markChatRead.mockClear();

    act(() => notificationStore.dispatch({ type: 'setDrawer', open: true }));
    receive(store, 'alice', 'under the drawer');
    expect(marks.markChatRead).not.toHaveBeenCalled();
    act(() => notificationStore.dispatch({ type: 'setDrawer', open: false }));
    expect(marks.markChatRead).toHaveBeenCalledWith('alice');
    expect(getVisibleChats()).toEqual(['alice']);
  });

  it('marks read on a new message even when the conversation is at its cap and its length stays the same', () => {
    const full = Array.from({ length: server.MAX_USER_MESSAGES }, (_, i) => Object.assign(
      create(Event_UserMessageSchema, { senderName: 'alice', receiverName: 'me', message: `old ${i}` }),
      { timeReceived: i },
    ));
    const capped = { ...state, server: { ...state.server, messages: { alice: full } } };
    const { store } = renderWithProviders(<ChatDock />, { preloadedState: capped });
    open('alice');
    marks.markChatRead.mockClear();

    receive(store, 'alice', 'one more');

    const conversation = store.getState().server.messages.alice;
    expect(conversation).toHaveLength(server.MAX_USER_MESSAGES);
    expect(conversation.at(-1)?.message).toBe('one more');
    expect(marks.markChatRead).toHaveBeenCalledTimes(1);
    expect(marks.markChatRead).toHaveBeenCalledWith('alice');
  });

  it('moves focus to the bar after minimising and back to the opener after closing', () => {
    renderWithProviders(<><button type="button">opener</button><ChatDock /></>, { preloadedState: state });
    const opener = screen.getByRole('button', { name: 'opener' });
    opener.focus();
    open('alice');
    fireEvent.click(screen.getByRole('button', { name: 'ChatDock.minimise' }));
    expect(screen.getByRole('button', { name: 'ChatDock.open' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'ChatDock.open' }));
    fireEvent.click(screen.getByRole('button', { name: 'ChatDock.close' }));
    expect(opener).toHaveFocus();
  });

  it('collapses open windows when a game opens', () => {
    act(() => dispatchChatDock({ type: 'open', name: 'alice', max: 3 }));
    renderWithProviders(<ChatDock />, { preloadedState: state, route: '/game/7' });
    expect(getChatDockState().chats).toEqual([{ name: 'alice', expanded: false }]);
  });
});

describe('focusAfterClose', () => {
  const chat = (name: string, expanded: boolean) => ({ name, expanded });
  it('prefers a neighbouring window, then a bar, then the opener', () => {
    const windows = [chat('a', true), chat('b', true)];
    expect(focusAfterClose(windows, [], 'b')).toEqual({ kind: 'input', name: 'a' });
    expect(focusAfterClose([chat('a', true)], [chat('c', false)], 'a')).toEqual({ kind: 'bar', name: 'c' });
    expect(focusAfterClose([chat('a', true)], [], 'a')).toBe('opener');
    expect(focusAfterClose([], [chat('c', false), chat('d', false)], 'c')).toEqual({ kind: 'bar', name: 'd' });
    expect(focusAfterClose([chat('a', true)], [chat('c', false)], 'c')).toEqual({ kind: 'input', name: 'a' });
  });
});

const placeAt = (el: HTMLElement, left: number, top = 0) => {
  el.getBoundingClientRect = () => ({ left, top } as DOMRect);
};

const sidebarAt = (left: number) => {
  const el = document.createElement('div');
  el.setAttribute('data-chat-dock-avoid', '');
  placeAt(el, left);
  return el;
};

const trayAt = (left: number, top: number, keep: number) => {
  const el = document.createElement('div');
  el.setAttribute('data-chat-dock-keep', String(keep));
  placeAt(el, left, top);
  return el;
};

const viewport = { width: 1440, height: 900 };

describe('measureDockSpace', () => {
  it('outside a game keeps the page reserve on the left of the viewport', () => {
    const root = document.createElement('div');
    expect(measureDockSpace(root, viewport)).toEqual({ inset: 0, room: 1440 - 12 - 468, liftedRoom: 1440 - 12 - 468, lift: 0 });
  });

  it('in a game docks left of the sidebar and keeps the tray controls clear', () => {
    const root = document.createElement('div');
    root.append(sidebarAt(1152), trayAt(76, 740, 600));
    expect(measureDockSpace(root, viewport)).toEqual({
      inset: 288,
      room: 1152 - 12 - 76 - 600,
      liftedRoom: 1152 - 12 - 76 - 12,
      lift: 160,
    });
  });
});

describe('placeDock', () => {
  const space = { inset: 288, room: 464, liftedRoom: 1052, lift: 160 };

  it('sits on the bottom edge while one window, plus a chip slot if needed, fits beside the tray controls', () => {
    expect(placeDock(space, 1)).toEqual({ room: 464, bottom: 0 });
    expect(placeDock({ ...space, room: 468 }, 2)).toEqual({ room: 468, bottom: 0 });
  });

  it('lifts onto the tray when the bottom edge has no room, and never lifts outside a game', () => {
    expect(placeDock(space, 2)).toEqual({ room: 1052, bottom: 160 });
    expect(placeDock({ inset: 0, room: 100, liftedRoom: 100, lift: 0 }, 3)).toEqual({ room: 100, bottom: 0 });
  });
});

describe('watchDockSpace', () => {
  it('re-measures when the sidebar or tray appears, resizes or changes what it keeps', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const rooms: number[] = [];
    const stop = watchDockSpace((space) => rooms.push(space.room), root);
    const sidebar = sidebarAt(window.innerWidth - 300);
    const tray = trayAt(0, 0, 200);
    root.append(sidebar, tray);
    await new Promise((resolve) => setTimeout(resolve, 0));
    tray.setAttribute('data-chat-dock-keep', '400');
    await new Promise((resolve) => setTimeout(resolve, 0));
    placeAt(sidebar, window.innerWidth - 44);
    window.dispatchEvent(new Event('resize'));
    stop();
    root.remove();
    const right = window.innerWidth - 12;
    expect(rooms).toEqual([right - 468, right - 300 - 200, right - 300 - 400, right - 44 - 400]);
  });
});
