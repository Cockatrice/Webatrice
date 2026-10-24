import type { Message } from '@cockatrice/datatrice';
import { formatChatContext } from '@app/dialogs';
import { findChatAlert, formatChatHistoryTime, type ChatAlertContext } from '@app/utils';
import { Event_RoomSay_RoomMessageType } from '@cockatrice/sockatrice/generated';

export function historyTimestamp(message: Message): string | undefined {
  if (message.messageType !== Event_RoomSay_RoomMessageType.ChatHistory || !message.timeOf) {
    return undefined;
  }
  return formatChatHistoryTime(Number(message.timeOf));
}

export function roomChatContext(messages: Message[] | undefined): string {
  return formatChatContext((messages ?? []).map((m) => {
    const prefix = `${m.name}: `;
    const message = m.name && m.message.startsWith(prefix) ? m.message.slice(prefix.length) : m.message;
    const timestamp = historyTimestamp(m);
    return {
      userName: m.name,
      message: timestamp ? `[${timestamp}] ${message}` : message,
      timeReceived: m.timeReceived,
    };
  }));
}

export interface ChatLineTime {
  label: string;
  dateTime: string;
  full?: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function chatLineTime(message: Message): ChatLineTime {
  const history = message.messageType === Event_RoomSay_RoomMessageType.ChatHistory && Boolean(message.timeOf);
  const epoch = history ? Number(message.timeOf) : message.timeReceived;
  const date = new Date(epoch);
  return {
    label: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
    dateTime: date.toISOString(),
    full: history ? formatChatHistoryTime(epoch) : undefined,
  };
}

export function isChatHistory(message: Message): boolean {
  return message.messageType === Event_RoomSay_RoomMessageType.ChatHistory;
}

export function isAlertLine(message: Message, highlight: ChatAlertContext): boolean {
  if (!message.name || message.notice) {
    return false;
  }
  const alert = findChatAlert(message.message, highlight);
  return alert === 'mention' || alert === 'allMention';
}

export function isBlankLine(message: Message): boolean {
  return !message.notice && message.message.trim() === '';
}

export function isWelcome(message: Message): boolean {
  return message.messageType === Event_RoomSay_RoomMessageType.Welcome;
}
