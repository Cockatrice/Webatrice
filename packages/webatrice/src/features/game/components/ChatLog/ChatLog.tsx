import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import { games } from '@cockatrice/datatrice';

import { PlayerLink, useMentionCompleter } from '@app/components';
import { usePreference } from '@app/hooks';
import { ReportChatScope } from '@app/dialogs';
import { GameLogRows } from '@app/feature-widgets/replay-player';
import { ShortcutScope, useShortcut } from '@app/feature-widgets/shortcuts';
import { useAppSelector } from '@app/store';

import { useGameId } from '../ui/GameIdContext';
import { useGameReadOnly } from '../ui/GameReadOnlyContext';
import { useCardPreviewActions } from '../ui/CardPreviewContext';

import { gameChatContext } from './gameChatContext';
import { GAME_FOCUS_RING } from '../ui/focusRing';
import { formatElapsed, useGameLog } from './useGameLog';

/**
 * Shared chat + event log used both in the pre-game lobby and inside
 * the game screen sidebar. Reads its gameId from `useGameId()` context
 * so both mount sites just render `<ChatLog />` — no prop threading.
 *
 * Event lines are rendered with per-token styling (card names, player
 * names, numbers each get their own accent color) and alternating row
 * backgrounds so consecutive log lines are visually separable.
 */
export interface ChatLogProps {
  onReveal?: () => void;
  visible?: boolean;
}

export default function ChatLog({ onReveal, visible }: ChatLogProps = {}) {
  const gameId = useGameId();
  const messages = useAppSelector((state) => (gameId != null ? games.Selectors.getMessages(state, gameId) : undefined));
  const getChatContext = useCallback(() => gameChatContext(messages ?? []), [messages]);
  return (
    <ReportChatScope gameId={gameId ?? undefined} getChatContext={getChatContext}>
      <ChatLogView onReveal={onReveal} visible={visible} />
    </ReportChatScope>
  );
}

function ChatLogView({ onReveal, visible }: ChatLogProps) {
  const { t } = useTranslation();
  const gameId = useGameId();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const { setHoveredCard, openBigPreview, closeBigPreview } = useCardPreviewActions();
  const {
    messages,
    players,
    displaySeconds,
    draft,
    setDraft,
    handleMessagesScroll,
    handleSubmit,
    canChat,
    chatDisabledReason,
  } = useGameLog({ gameId, listRef, visible });
  const names = useMemo(
    () => Object.values(players ?? {}).flatMap((player) => player.properties.userInfo?.name ?? []),
    [players],
  );
  const mention = useMentionCompleter({ names, value: draft, onValueChange: setDraft, inputRef });
  const stampGameTime = usePreference('useGameTime');
  const readOnly = useGameReadOnly();
  const inputDisabled = gameId == null || !canChat || readOnly;
  const handleCardBigPreview = useCallback((card: { name: string }, open: boolean) => {
    if (open) {
      openBigPreview(card);
    } else {
      closeBigPreview();
    }
  }, [closeBigPreview, openBigPreview]);
  const renderSender = useCallback(
    (senderName: string) => (!readOnly ? <PlayerLink name={senderName} /> : senderName),
    [readOnly],
  );

  // Cockatrice-parity focus-chat shortcut (Shift+Enter). Registered
  // GLOBAL so it fires regardless of route, but only actually mounted
  // when ChatLog is on-screen. Disabled state gates it — focusing a
  // disabled input would be a no-op, but skipping the preventDefault
  // lets Shift+Enter fall through to whatever else is listening.
  const [focusRequest, setFocusRequest] = useState(0);
  useShortcut(
    'chat.focus',
    () => {
      if (inputDisabled) {
        return;
      }
      onReveal?.();
      setFocusRequest((n) => n + 1);
    },
    { scope: ShortcutScope.GAME, enabled: !inputDisabled },
  );
  useEffect(() => {
    const el = inputRef.current;
    if (focusRequest === 0 || !el) {
      return;
    }
    el.focus();
    el.select();
  }, [focusRequest]);
  const inputTitle = chatDisabledReason ?? undefined;
  const inputPlaceholder = gameId == null
    ? t('ChatLog.unavailable')
    : (chatDisabledReason ?? t('ChatLog.placeholder'));

  return (
    <div data-testid="game-log" className="flex flex-col h-full min-h-0">
      {/* Header — label on the left, elapsed timer on the right. Timer
           hides when there's no active game (lobby chat renders with no
           gameId while the game hasn't started yet). */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 text-[10px] uppercase tracking-widest text-text-muted">
        <h2 id={headingId} className="flex items-center gap-1">
          <MessageSquare size={11} aria-hidden /> {t('ChatLog.heading')}
        </h2>
        {gameId != null && !readOnly && (
          <span
            data-testid="game-log-timer"
            className="tabular-nums normal-case tracking-normal"
          >
            {formatElapsed(displaySeconds)}
          </span>
        )}
      </div>

      <div
        ref={listRef}
        role="log"
        tabIndex={0}
        aria-live="polite"
        aria-relevant="additions"
        aria-labelledby={headingId}
        onScroll={handleMessagesScroll}
        className="scrollable flex-1 min-h-0 overflow-y-auto py-1 text-xs"
      >
        {messages.length === 0 && (
          <div className="italic text-text-muted px-3 py-1">{t('ChatLog.empty')}</div>
        )}
        <GameLogRows
          messages={messages}
          players={players}
          stampGameTime={stampGameTime}
          onCardHover={setHoveredCard}
          onCardBigPreview={handleCardBigPreview}
          renderSender={renderSender}
        />
      </div>

      <form
        onSubmit={handleSubmit}
        hidden={readOnly}
        className="shrink-0 p-2 border-t border-border-subtle"
      >
        <label htmlFor="game-log-say-input" className="sr-only">
          {t('ChatLog.inputLabel')}
        </label>
        <div className="relative">
          <input
            id="game-log-say-input"
            ref={inputRef}
            type="text"
            value={draft}
            {...mention.inputProps}
            disabled={inputDisabled}
            placeholder={inputPlaceholder}
            // Native browser tooltip on hover — surfaces the disable
            // reason (e.g. "Spectators are not allowed to chat in this
            // game.") when the field is greyed out.
            title={inputTitle}
            aria-disabled={inputDisabled}
            className={[
              'w-full bg-bg-base border border-border-subtle rounded-md px-3 py-1.5 text-xs',
              'text-text-primary placeholder:text-text-muted focus:outline-none',
              GAME_FOCUS_RING,
              'focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed board-motion transition-colors',
            ].join(' ')}
          />
          {mention.popup}
        </div>
      </form>
    </div>
  );
}
