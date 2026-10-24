import { create } from '@bufbuild/protobuf';
import { Event_RoomSaySchema, Event_RoomSay_RoomMessageType } from '@cockatrice/sockatrice/generated';
import type { Message } from '@cockatrice/datatrice';

import { chatLineTime, isAlertLine, isBlankLine, roomChatContext } from './roomChatContext';

const at = new Date(2026, 0, 1, 12, 30, 5).getTime();

function stored(name: string, message: string): Message {
  return { ...create(Event_RoomSaySchema, { name, message: name ? `${name}: ${message}` : message }), timeReceived: at };
}

describe('roomChatContext', () => {
  it('keeps the original history time in the message, alongside its arrival time', () => {
    const message = stored('mallory', 'old message');
    message.messageType = Event_RoomSay_RoomMessageType.ChatHistory;
    message.timeOf = BigInt(new Date(2025, 11, 31, 23, 5, 7).getTime());
    expect(roomChatContext([message])).toBe('[12:30:05] mallory: [31 Dec 2025 23:05:07] old message');
    message.timeOf = 0n;
    expect(roomChatContext([message])).toBe('[12:30:05] mallory: old message');
  });

  it('strips the display prefix and drops system lines', () => {
    expect(roomChatContext([stored('', 'Server restarting'), stored('mallory', 'a: b')]))
      .toBe('[12:30:05] mallory: a: b');
  });

  it('is empty for a room without messages', () => {
    expect(roomChatContext(undefined)).toBe('');
  });
});

const highlight = {
  selfName: 'me', userNames: ['me', 'mallory'], mentions: true, highlightWords: [] as string[], senderIsModerator: false,
};

describe('chatLineTime', () => {
  it('uses the arrival time for live lines', () => {
    expect(chatLineTime(stored('mallory', 'hi'))).toMatchObject({ label: '12:30', full: undefined });
  });

  it('uses the server time for history lines and keeps the full date', () => {
    const message = stored('mallory', 'old');
    message.messageType = Event_RoomSay_RoomMessageType.ChatHistory;
    message.timeOf = BigInt(new Date(2025, 11, 31, 23, 5, 7).getTime());
    expect(chatLineTime(message)).toMatchObject({ label: '23:05', full: '31 Dec 2025 23:05:07' });
  });
});

describe('isAlertLine', () => {
  it('flags a line that mentions the reader', () => {
    expect(isAlertLine(stored('mallory', 'ping @me'), highlight)).toBe(true);
    expect(isAlertLine(stored('mallory', 'ping @mallory'), highlight)).toBe(false);
  });

  it('respects the mention preference and ignores system lines', () => {
    expect(isAlertLine(stored('mallory', 'ping @me'), { ...highlight, mentions: false })).toBe(false);
    expect(isAlertLine(stored('', '@me'), highlight)).toBe(false);
  });
});

describe('isBlankLine', () => {
  it('is true only for an empty line that is not a notice', () => {
    expect(isBlankLine(stored('', ' '))).toBe(true);
    expect(isBlankLine({ ...stored('', ''), notice: 'chatFlood' })).toBe(false);
    expect(isBlankLine(stored('mallory', 'hi'))).toBe(false);
  });
});
