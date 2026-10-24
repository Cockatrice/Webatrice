import type { GameMessage } from '@cockatrice/datatrice';
import { formatChatContext } from '@app/dialogs';

export function gameChatContext(messages: GameMessage[]): string {
  return formatChatContext(messages
    .filter((m) => m.kind === 'chat')
    .map((m) => ({
      userName: m.senderName ?? '',
      message: m.message,
      timeReceived: m.timeReceived,
    })));
}
