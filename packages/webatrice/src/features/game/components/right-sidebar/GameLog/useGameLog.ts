import { useEffect, useRef, useState, RefObject } from 'react';
import { useWebClient } from '@cockatrice/datatrice/react';
import { games } from '@cockatrice/datatrice';
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
}

export interface UseGameLogArgs {
  gameId: number | undefined;
  listRef: RefObject<HTMLDivElement | null>;
}

export function useGameLog({ gameId, listRef }: UseGameLogArgs): GameLog {
  const webClient = useWebClient();
  // Selector's EMPTY_ARRAY fallback is typed ServerInfo_Card[]; cast is safe at runtime.
  const messages = useAppSelector((state) =>
    gameId != null ? games.Selectors.getMessages(state, gameId) : EMPTY_MESSAGES,
  ) as GameMessage[];
  const players = useAppSelector((state) =>
    gameId != null ? games.Selectors.getPlayers(state, gameId) : undefined,
  );
  const secondsElapsed = useAppSelector((state) =>
    gameId != null ? games.Selectors.getSecondsElapsed(state, gameId) : 0,
  );

  // 1Hz ticker; resync to redux on each server `secondsElapsed`.
  const [displaySeconds, setDisplaySeconds] = useState(secondsElapsed);

  useEffect(() => {
    setDisplaySeconds(secondsElapsed);
  }, [secondsElapsed]);

  useEffect(() => {
    if (gameId == null) {
      return undefined;
    }
    const id = window.setInterval(() => {
      setDisplaySeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [gameId]);

  const [draft, setDraft] = useState('');

  // Pin to bottom unless the user scrolled up; capture before render.
  const wasPinnedRef = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    if (wasPinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, listRef]);

  const handleMessagesScroll = () => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    wasPinnedRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (gameId == null) {
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
  };
}
