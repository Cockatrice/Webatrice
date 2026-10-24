import { server } from '@cockatrice/datatrice';
import type { Event_UserMessage } from '@cockatrice/sockatrice/generated';

import type { RootState } from '@app/store';
import { chatFilterVerdicts, visiblePrivateMessages, type PrivateMessageFilter } from '@app/utils';

export function incomingChatPeer(
  action: { type: string | null; payload: unknown },
  state: RootState,
  filter: PrivateMessageFilter,
): string | null {
  if (action.type !== server.Types.USER_MESSAGE) {
    return null;
  }
  const { messageData } = action.payload as { messageData: Event_UserMessage };
  const selfName = state.server.user?.name ?? null;
  if (!selfName || messageData.senderName === selfName) {
    return null;
  }
  const peer = messageData.senderName;
  const list = state.server.messages[peer] ?? [];
  const entry = list.at(-1);
  if (!entry) {
    return null;
  }
  const cached = chatFilterVerdicts.get(entry);
  if (cached !== undefined) {
    return cached ? peer : null;
  }
  const visible = visiblePrivateMessages(
    list,
    { selfName, peer: state.server.users[peer], peerIsBuddy: Boolean(state.server.buddyList[peer]) },
    filter,
    chatFilterVerdicts,
  );
  return visible.includes(entry) ? peer : null;
}
