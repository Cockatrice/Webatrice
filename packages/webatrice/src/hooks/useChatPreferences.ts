import { useMemo } from 'react';
import { server } from '@cockatrice/datatrice';

import { useAppSelector } from '@app/store';
import {
  highlightStyle,
  parseHighlightWords,
  type ChatHighlight,
  type PrivateMessageFilter,
  type RoomChatFilter,
} from '@app/utils';

import { usePreferences } from './useSettings';

export function useRoomChatFilter(): RoomChatFilter {
  const { roomHistory, ignoreUnregisteredUsers } = usePreferences();
  return useMemo(() => ({ roomHistory, ignoreUnregisteredUsers }), [roomHistory, ignoreUnregisteredUsers]);
}

export function usePrivateMessageFilter(): PrivateMessageFilter {
  const { ignoreAllPrivateMessages, ignoreUnregisteredUserMessages, ignoreNonBuddyUserMessages } = usePreferences();
  return useMemo(
    () => ({ ignoreAllPrivateMessages, ignoreUnregisteredUserMessages, ignoreNonBuddyUserMessages }),
    [ignoreAllPrivateMessages, ignoreUnregisteredUserMessages, ignoreNonBuddyUserMessages],
  );
}

export interface ChatHighlights {
  user: ChatHighlight;
  moderator: ChatHighlight;
}

export function useChatHighlight(): ChatHighlights {
  const {
    chatMention,
    chatMentionColor,
    chatMentionForeground,
    chatHighlightWords,
    chatHighlightColor,
    chatHighlightForeground,
  } = usePreferences();
  const selfName = useAppSelector((state) => server.Selectors.getUser(state)?.name ?? null);

  const users = useAppSelector(server.Selectors.getUsers);

  return useMemo(() => {
    const user: ChatHighlight = {
      selfName,
      userNames: Object.keys(users),
      mentions: chatMention,
      mentionStyle: highlightStyle(chatMentionColor, chatMentionForeground),
      highlightWords: parseHighlightWords(chatHighlightWords),
      highlightStyle: highlightStyle(chatHighlightColor, chatHighlightForeground),
      senderIsModerator: false,
    };
    return { user, moderator: { ...user, senderIsModerator: true } };
  }, [
    selfName,
    users,
    chatMention,
    chatMentionColor,
    chatMentionForeground,
    chatHighlightWords,
    chatHighlightColor,
    chatHighlightForeground,
  ]);
}
