import { act, fireEvent, screen, within } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { rooms, type Message } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import {
  Event_RoomSay_RoomMessageType,
  Event_RoomSaySchema,
  ServerInfo_User_UserLevelFlag as Level,
} from '@cockatrice/sockatrice/generated';

import { renderWithProviders, connectedState, makeUser } from '../../../__test-utils__';
import { getSettings, settingsStore } from '../../../hooks/useSettings';
import type { Preferences } from '../../../types';
import RoomChat from './RoomChat';
import * as chatContext from './roomChatContext';

const reportScope = vi.hoisted(() => ({ getChatContext: undefined as (() => string) | undefined }));
vi.mock('@app/dialogs', async (importOriginal) => ({
  ...await importOriginal<typeof import('@app/dialogs')>(),
  ReportChatScope: ({ children, getChatContext }: { children: React.ReactNode; getChatContext: () => string }) => {
    reportScope.getChatContext = getChatContext;
    return children;
  },
}));

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  ...create(Event_RoomSaySchema, { name: 'alice', message: 'alice: hello' }),
  timeReceived: 1,
  id: 1,
  ...overrides,
});

function renderChat(messages: Message[] = [], onSay = vi.fn()) {
  return renderWithProviders(
    <RoomChat roomId={1} roomName="Main" messages={messages} users={{}} onSay={onSay} />,
    { preloadedState: connectedState },
  );
}

describe('RoomChat', () => {
  it.each([{ messages: undefined }, { messages: [] }])('shows the empty log when messages are $messages', ({ messages }) => {
    renderWithProviders(<RoomChat roomId={1} roomName="Main" messages={messages} users={{}} onSay={vi.fn()} />);
    expect(within(screen.getByRole('log')).getByText('RoomChat.empty')).toBeInTheDocument();
  });

  it('renders one row per message in order', () => {
    renderChat([makeMessage({ message: 'first' }), makeMessage({ message: 'second', id: 2, timeReceived: 2 })]);
    const log = screen.getByRole('log');
    expect(log.children).toHaveLength(2);
    expect(log.children[0]).toHaveTextContent('first');
    expect(log.children[1]).toHaveTextContent('second');
    expect(within(log).queryByText('RoomChat.empty')).not.toBeInTheDocument();
  });

  it('is a labelled log with a labelled input, so screen readers hear and can answer the room', () => {
    renderChat([makeMessage({ message: 'hello room' })]);

    expect(screen.getByRole('log', { name: 'RoomChat.log' })).toHaveTextContent('hello room');
    expect(screen.getByRole('combobox', { name: 'RoomChat.input' })).toBeInTheDocument();
  });

  it('stamps chat history lines with their server time, keeping the full date in the title', () => {
    const timeOf = BigInt(new Date(2026, 9, 3, 9, 5, 7).getTime());
    const { container } = renderChat([
      makeMessage({ messageType: Event_RoomSay_RoomMessageType.ChatHistory, timeOf }),
    ]);
    const time = container.querySelector('time');
    expect(time).toHaveTextContent('09:05');
    expect(time).toHaveAttribute('title', '3 Oct 2026 09:05:07');
  });

  it('stamps live messages with their arrival time', () => {
    const timeReceived = new Date(2026, 9, 3, 20, 4).getTime();
    const { container } = renderChat([makeMessage({ timeOf: 5n, timeReceived })]);
    const time = container.querySelector('time');
    expect(time).toHaveTextContent('20:04');
    expect(time).not.toHaveAttribute('title');
  });

  it('shows the room welcome without a sender or time, and drops empty lines', () => {
    const { container } = renderChat([
      makeMessage({ message: 'Welcome to Main', messageType: Event_RoomSay_RoomMessageType.Welcome }),
      makeMessage({ message: '', id: 2 }),
    ]);
    const log = screen.getByRole('log');
    expect(log.children).toHaveLength(1);
    expect(log).toHaveTextContent('Welcome to Main');
    expect(container.querySelector('time')).not.toBeInTheDocument();
  });

  it('renders a chat flood notice', () => {
    renderChat([makeMessage({ message: '', notice: 'chatFlood' })]);
    expect(screen.getByText('RoomChat.notice.chatFlood')).toBeInTheDocument();
  });

  it('renders a not-sent notice with the transport reason', () => {
    renderChat([makeMessage({ message: '', notice: 'notSent', failure: WebsocketTypes.CommandFailure.Timeout })]);
    expect(screen.getByText('RoomChat.notice.notSent')).toBeInTheDocument();
  });

  it('sends the draft and clears the input', () => {
    const onSay = vi.fn();
    renderChat([], onSay);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'hi all' } });
    fireEvent.submit(input);
    expect(onSay).toHaveBeenCalledWith({ message: 'hi all' });
    expect(input).toHaveValue('');
  });

  it('restores the unsent text into an empty input when this room floods', () => {
    const { store } = renderChat();
    act(() => {
      store.dispatch(rooms.Actions.roomSayFailed({ roomId: 2, message: 'other room', responseCode: 18, timeReceived: 1 }));
      store.dispatch(rooms.Actions.roomSayFailed({ roomId: 1, message: 'too fast', responseCode: 18, timeReceived: 2 }));
    });
    expect(screen.getByRole('combobox')).toHaveValue('too fast');
  });

  it('restores a draft when sending fails synchronously with NotSent', () => {
    const onSay = vi.fn();
    const { store } = renderChat([], onSay);
    onSay.mockImplementation(({ message }: { message: string }) => {
      store.dispatch(rooms.Actions.roomSayFailed({
        roomId: 1, message, responseCode: -1, timeReceived: 2,
        failure: WebsocketTypes.CommandFailure.NotSent,
      }));
    });
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'hi all' } });
    fireEvent.submit(input);
    expect(input).toHaveValue('hi all');
  });

  it('keeps what the user has typed since the flooded send', () => {
    const { store } = renderChat();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'newer' } });
    act(() => {
      store.dispatch(rooms.Actions.roomSayFailed({ roomId: 1, message: 'too fast', responseCode: 18, timeReceived: 2 }));
    });
    expect(screen.getByRole('combobox')).toHaveValue('newer');
  });

  it('completes @mentions from the room\'s user list', () => {
    renderWithProviders(
      <RoomChat
        roomId={1}
        roomName="Main"
        messages={[]}
        users={{ alice: makeUser({ name: 'alice' }), bob: makeUser({ name: 'bob' }) }}
        onSay={vi.fn()}
      />,
      { preloadedState: connectedState },
    );
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'gg @b' } });
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['@bob']);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('gg @bob ');
  });

  describe('chat preferences', () => {
    const say = (name: string, text: string, messageType = Event_RoomSay_RoomMessageType.UserMessage): Message => ({
      ...create(Event_RoomSaySchema, { name, message: `${name}: ${text}`, messageType }),
      timeReceived: 0,
    });

    const users = {
      member: makeUser({ name: 'member', userLevel: Level.IsUser | Level.IsRegistered }),
      guest: makeUser({ name: 'guest', userLevel: Level.IsUser }),
      mod: makeUser({ name: 'mod', userLevel: Level.IsUser | Level.IsRegistered | Level.IsModerator }),
    };

    const messages = (): Message[] => [
      makeMessage({ message: 'old: earlier', messageType: Event_RoomSay_RoomMessageType.ChatHistory }),
      say('member', 'hello @TestUser'),
      say('guest', 'guest says hi'),
      say('mod', '@/all restart soon'),
      makeMessage({ message: '', notice: 'chatFlood' }),
    ];

    const setPreferences = async (patch: Partial<Preferences>) => {
      const settings = await getSettings();
      Object.assign(settings, patch);
      settingsStore.setValue(settings);
    };

    const renderWithUsers = (lines = messages()) =>
      renderWithProviders(<RoomChat roomId={1} roomName="Main" messages={lines} users={users} onSay={vi.fn()} />, {
        preloadedState: connectedState,
      });

    beforeEach(async () => {
      settingsStore.reset();
      await getSettings();
    });

    it('shows history and every sender by default, highlighting the reader’s mention and a moderator’s @/all', () => {
      renderWithUsers();

      expect(screen.getByText(/earlier/)).toBeInTheDocument();
      expect(screen.getByText(/guest says hi/)).toBeInTheDocument();
      expect(screen.getByText('@TestUser').tagName).toBe('MARK');
      expect(screen.getByText('@/all').tagName).toBe('MARK');
    });

    it('hides join history when room history is off, keeping notices', async () => {
      await setPreferences({ roomHistory: false });
      renderWithUsers();

      expect(screen.queryByText(/earlier/)).not.toBeInTheDocument();
      expect(screen.getByText(/guest says hi/)).toBeInTheDocument();
      expect(screen.getByText('RoomChat.notice.chatFlood')).toBeInTheDocument();
    });

    it('attaches only visible messages to a report', async () => {
      await setPreferences({ ignoreUnregisteredUsers: true, roomHistory: false });
      renderWithUsers();
      const context = reportScope.getChatContext?.();
      expect(context).toContain('hello');
      expect(context).not.toContain('guest says hi');
      expect(context).not.toContain('earlier');
    });

    it('hides unregistered senders when asked, keeping notices', async () => {
      await setPreferences({ ignoreUnregisteredUsers: true });
      renderWithUsers();

      expect(screen.queryByText(/guest says hi/)).not.toBeInTheDocument();
      expect(screen.getByText(/hello/)).toBeInTheDocument();
      expect(screen.getByText('RoomChat.notice.chatFlood')).toBeInTheDocument();
    });

    it('keeps a filtered line hidden after its sender leaves the room', async () => {
      await setPreferences({ ignoreUnregisteredUsers: true });
      const lines = messages();
      const { rerender } = renderWithUsers(lines);
      expect(screen.queryByText(/guest says hi/)).not.toBeInTheDocument();

      const { guest: _left, ...remaining } = users;
      rerender(<RoomChat roomId={1} roomName="Main" messages={lines} users={remaining} onSay={vi.fn()} />);

      expect(screen.queryByText(/guest says hi/)).not.toBeInTheDocument();
    });

    it('keeps the lines it showed when a filter is turned on later', async () => {
      const lines = messages();
      const { rerender } = renderWithUsers(lines);

      await act(async () => {
        await setPreferences({ ignoreUnregisteredUsers: true });
      });
      rerender(<RoomChat roomId={1} roomName="Main" messages={lines} users={users} onSay={vi.fn()} />);

      expect(screen.getByText(/guest says hi/)).toBeInTheDocument();
    });

    it('follows a preference change while open', async () => {
      renderWithUsers();
      expect(screen.getByText('@TestUser').tagName).toBe('MARK');

      await act(async () => {
        await setPreferences({ chatMention: false });
      });

      expect(screen.queryByText('@TestUser')).not.toBeInTheDocument();
      expect(screen.getByText(/hello @TestUser/)).toBeInTheDocument();
    });
  });
});


describe('RoomChat rendering', () => {
  it('retains all surviving rows when the capped transcript advances, including welcome rows', () => {
    const messages = Array.from({ length: 1000 }, (_, id) => makeMessage({
      id, message: `line ${id}`, timeReceived: 123,
      messageType: id === 1 ? Event_RoomSay_RoomMessageType.Welcome : undefined,
    }));
    const users = {};
    const onSay = vi.fn();
    const { rerender } = renderWithProviders(<RoomChat roomId={1} roomName="Main" messages={messages} users={users} onSay={onSay} />);
    const before = Array.from(screen.getByRole('log').children);
    const format = vi.spyOn(chatContext, 'chatLineTime');
    const advanced = [...messages.slice(1), makeMessage({ id: 1000, message: 'new line' })];
    rerender(<RoomChat roomId={1} roomName="Main" messages={advanced} users={users} onSay={onSay} />);
    const after = Array.from(screen.getByRole('log').children);
    expect(after).toHaveLength(1000);
    before.slice(1).forEach((node, index) => expect(after[index]).toBe(node));
    expect(format).toHaveBeenCalledTimes(1);
  });

  it('does not map the transcript or format rows while typing, and still scrolls on arrival', () => {
    const messages = [makeMessage()];
    const filter = vi.spyOn(messages, 'filter');
    const { rerender } = renderChat(messages);
    const visible = filter.mock.results[0].value as Message[];
    const map = vi.spyOn(visible, 'map');
    const format = vi.spyOn(chatContext, 'chatLineTime');
    const log = screen.getByRole('log');
    Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 200 });
    log.scrollTop = 10;
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'draft' } });
    expect(map).not.toHaveBeenCalled();
    expect(format).not.toHaveBeenCalled();
    expect(log.scrollTop).toBe(10);
    rerender(<RoomChat roomId={1} roomName="Main" messages={[...messages, makeMessage({ id: 2 })]} users={{}} onSay={vi.fn()} />);
    expect(log.scrollTop).toBe(200);
  });
});
