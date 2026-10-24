import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState, RefObject } from 'react';
import { useGameClock } from './useGameClock';
import { useWebClient } from '@cockatrice/datatrice/react';
import { games, server } from '@cockatrice/datatrice';
import { useAdminLocked } from '@app/hooks';
import { useAppSelector } from '@app/store';
import { GameMessage, PlayerEntry } from '@cockatrice/datatrice';
const EMPTY_MESSAGES: GameMessage[] = [];

export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export interface GameLog {
  messages: GameMessage[];
  players: Record<number, PlayerEntry> | undefined;
  displaySeconds: number;
  draft: string;
  setDraft: (v: string) => void;
  handleMessagesScroll: () => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Whether the local user is allowed to send chat in this game.
   *  False for spectators of games where `spectators_can_chat` is off
   *  — the input is disabled with `chatDisabledReason` as its title. */
  canChat: boolean;
  /** Human-readable reason chat is disabled, or null when it isn't.
   *  Rendered as the input's `title` (native browser tooltip on hover)
   *  and as its `placeholder` so it's visible without hover too. */
  chatDisabledReason: string | null;
}

export interface UseGameLogArgs {
  gameId: number | undefined;
  listRef: RefObject<HTMLDivElement | null>;
  visible?: boolean;
}

export function useGameLog({ gameId, listRef, visible = true }: UseGameLogArgs): GameLog {
  const { t } = useTranslation();
  const webClient = useWebClient();
  const messages = useAppSelector((state) =>
    gameId != null ? games.Selectors.getMessages(state, gameId) : EMPTY_MESSAGES,
  );
  const players = useAppSelector((state) =>
    gameId != null ? games.Selectors.getPlayers(state, gameId) : undefined,
  );
  const isSpectator = useAppSelector((state) =>
    gameId != null ? games.Selectors.isSpectator(state, gameId) : false,
  );
  // Cockatrice's `spectators_can_chat` game setting. Spectators can
  // only cmdGameSay when this flag is set — servatrice rejects the
  // command otherwise, so we disable the input up front rather than
  // let the user type a message that will silently fail.
  const spectatorsCanChat = useAppSelector((state) => {
    if (gameId == null) {
      return true;
    }
    return games.Selectors.getGame(state, gameId)?.info.spectatorsCanChat ?? true;
  });
  const isModerator = useAppSelector(server.Selectors.getIsUserModerator);
  const adminLocked = useAdminLocked();
  const isJudge = useAppSelector((state) =>
    gameId != null ? games.Selectors.getJudge(state, gameId) : false,
  );
  const canOverride = (isModerator && !adminLocked) || isJudge;
  const canChat = !(isSpectator && !spectatorsCanChat && !canOverride);
  const chatDisabledReason = canChat
    ? null
    : t('ChatLog.spectatorChatDisabled');

  const displaySeconds = useGameClock(gameId);

  const [draft, setDraft] = useState('');

  // Pin to bottom unless the user scrolled up; capture before render.
  const wasPinnedRef = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (!el || !visible) {
      return;
    }
    if (wasPinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, listRef, visible]);

  const handleMessagesScroll = () => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    wasPinnedRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (gameId == null || !canChat) {
      return;
    }
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      return;
    }
    webClient.request.game.gameSay(gameId, { message: trimmed });
    setDraft('');
  };

  return {
    messages,
    players,
    displaySeconds,
    draft,
    setDraft,
    handleMessagesScroll,
    handleSubmit,
    canChat,
    chatDisabledReason,
  };
}
