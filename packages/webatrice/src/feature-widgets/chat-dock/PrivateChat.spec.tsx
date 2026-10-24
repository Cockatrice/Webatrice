import { act, fireEvent, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { server, type PrivateConversationEntry } from '@cockatrice/datatrice';
import { Event_UserMessageSchema, Response_ResponseCode } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { renderWithProviders, connectedState } from '../../__test-utils__';
import PrivateChat from './PrivateChat';

const rowRender = vi.hoisted(() => vi.fn());
vi.mock('@app/components', async (importOriginal) => {
  const original = await importOriginal<typeof import('@app/components')>();
  return {
    ...original,
    MessageText: (props: React.ComponentProps<typeof original.MessageText>) => {
      rowRender(props.text);
      return <original.MessageText {...props} />;
    },
  };
});
import { getSettings, settingsStore } from '../../hooks/useSettings';
import { dispatchChatDock } from '../../hooks/useChatDock';

afterEach(() => {
  dispatchChatDock({ type: 'reset' });
});

const message = (senderName: string, text: string): PrivateConversationEntry => ({
  type: 'message',
  message: Object.assign(
    create(Event_UserMessageSchema, { senderName, receiverName: senderName === 'me' ? 'bob' : 'me', message: text }),
    { timeReceived: 123 },
  ),
});

const notice = (id: number, kind: 'userLeft' | 'recipientOffline'): PrivateConversationEntry => ({
  type: 'notice',
  notice: { id, kind, position: 0 },
});

function renderChat(props: Partial<React.ComponentProps<typeof PrivateChat>> = {}) {
  const onSend = vi.fn();
  const utils = renderWithProviders(
    <PrivateChat
      peerName="bob"
      selfName="me"
      entries={[]}
      isOnline
      isIgnored={false}
      onSend={onSend}
      {...props}
    />,
    { preloadedState: connectedState },
  );
  return { ...utils, onSend };
}

describe('PrivateChat', () => {
  it('highlights mentions and alert words without consuming a sender-like body prefix', async () => {
    settingsStore.reset();
    const settings = await getSettings();
    settings.chatHighlightWords = 'cube';
    settings.chatMention = true;
    settingsStore.setValue(settings);
    const { container } = renderChat({ entries: [message('bob', 'note: (@testUser) (cube)')] });
    expect(screen.getByText('@testUser').tagName).toBe('MARK');
    expect(screen.getByText('cube').tagName).toBe('MARK');
    expect(container).toHaveTextContent('note: (@testUser) (cube)');
  });

  it('renders messages and notices in conversation order', () => {
    renderChat({
      entries: [message('bob', 'hey'), notice(1, 'userLeft'), message('me', 'still there?'), notice(2, 'recipientOffline')],
    });
    const log = screen.getByRole('log', { name: 'PrivateChat.log' });
    const rows = Array.from(log.children).map((row) => row.textContent).filter(Boolean);
    expect(rows).toEqual(['bob: hey', 'PrivateChat.notice.userLeft', 'me: still there?', 'PrivateChat.notice.recipientOffline']);
  });

  it('is a labelled log, so screen readers hear incoming messages', () => {
    renderChat({ entries: [message('bob', 'hey')] });

    const log = screen.getByRole('log', { name: 'PrivateChat.log' });
    expect(log).toHaveTextContent('bob: hey');
    expect(screen.getByRole('textbox', { name: 'PrivateChat.input' })).toBeInTheDocument();
  });

  it('explains a message the server never answered', () => {
    renderChat({
      entries: [{ type: 'notice', notice: { id: 9, kind: 'notSent', position: 0, failure: WebsocketTypes.CommandFailure.Timeout } }],
    });
    expect(screen.getByText('PrivateChat.notice.notSent')).toBeInTheDocument();
  });

  it('names its input, a plain textbox as on desktop, which has no completer in message tabs', () => {
    renderChat();

    expect(screen.getByRole('textbox', { name: 'PrivateChat.input' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows the peer as online and sends a trimmed draft', () => {
    const { onSend } = renderChat();
    expect(screen.getByTestId('private-chat-presence')).toHaveTextContent('PrivateChat.presence.online');

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  hello  ' } });
    fireEvent.submit(input);
    expect(onSend).toHaveBeenCalledWith('hello');
    expect(input).toHaveValue('');
  });

  it('keeps the draft and explains why while the peer is offline', () => {
    const { onSend } = renderChat({ isOnline: false });
    expect(screen.getByTestId('private-chat-presence')).toHaveTextContent('PrivateChat.presence.offline');
    expect(screen.getByText('PrivateChat.blocked.offline')).toBeInTheDocument();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.submit(input);
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue('hello');
    expect(screen.getByRole('button', { name: 'Common.action.send' })).toBeDisabled();
  });

  it('refuses to send to a user you have ignored', () => {
    const { onSend } = renderChat({ isIgnored: true });
    expect(screen.getByText('PrivateChat.blocked.ignoring')).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.submit(input);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('restores the unsent text into an empty composer when a send to this peer fails', () => {
    const { store } = renderChat();
    act(() => {
      store.dispatch(server.Actions.privateMessageFailed({
        userName: 'carol', message: 'not for bob', responseCode: Response_ResponseCode.RespChatFlood,
      }));
      store.dispatch(server.Actions.privateMessageFailed({
        userName: 'bob', message: 'are you there?', responseCode: Response_ResponseCode.RespNameNotFound,
      }));
    });
    expect(screen.getByRole('textbox')).toHaveValue('are you there?');
  });

  it('restores a draft when sending fails synchronously with NotSent', () => {
    const { store, onSend } = renderChat();
    onSend.mockImplementation((message: string) => {
      store.dispatch(server.Actions.privateMessageFailed({
        userName: 'bob', message, responseCode: Response_ResponseCode.RespNotConnected,
        failure: WebsocketTypes.CommandFailure.NotSent,
      }));
    });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.submit(input);
    expect(input).toHaveValue('hello');
  });

  it('does not overwrite text typed since the failed send', () => {
    const { store } = renderChat();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'newer' } });
    act(() => {
      store.dispatch(server.Actions.privateMessageFailed({
        userName: 'bob', message: 'older', responseCode: Response_ResponseCode.RespChatFlood,
      }));
    });
    expect(screen.getByRole('textbox')).toHaveValue('newer');
  });
});


describe('PrivateChat rendering', () => {
  it('does not map the transcript or render message rows while typing', () => {
    const entries = [message('bob', 'retained')];
    renderChat({ entries });
    const map = vi.spyOn(entries, 'map');
    rowRender.mockClear();
    const log = screen.getByRole('log');
    log.scrollTop = 10;
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'draft' } });
    expect(map).not.toHaveBeenCalled();
    expect(rowRender).not.toHaveBeenCalled();
    expect(log.scrollTop).toBe(10);
  });

  it('keeps message rows mounted and skips their render when conversation wrappers are rebuilt', () => {
    const first = message('bob', 'retained');
    const { rerender } = renderChat({ entries: [first] });
    const bubble = screen.getByText('retained');
    rowRender.mockClear();
    const log = screen.getByRole('log');
    Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 200 });
    const entries = [{ ...first }, message('me', 'new')];
    rerender(<PrivateChat peerName="bob" selfName="me" entries={entries} isOnline isIgnored={false} onSend={vi.fn()} />);
    expect(screen.getByText('retained')).toBe(bubble);
    expect(rowRender.mock.calls.map(([text]) => text)).toEqual(['new']);
    expect(log.scrollTop).toBe(200);
  });
});
