import { useRef } from 'react';
import { MessageSquare } from 'lucide-react';

import { useGameId } from '../ui/GameIdContext';

import { formatElapsed, useGameLog } from './useGameLog';

/**
 * Shared chat + event log used both in the pre-game lobby and inside
 * the game screen sidebar. Reads its gameId from `useGameId()` context
 * so both mount sites just render `<ChatLog />` — no prop threading.
 *
 * Layout (top → bottom):
 *   • Header row: `Chat & log` label + elapsed game timer (right)
 *   • Scrollable messages pane: chat lines with author accent, event
 *     lines italicized in muted text
 *   • Input row: form-submits on Enter, disabled when there's no
 *     active game
 *
 * Visual is ported from fancy webatrice's BattlefieldSidebar chat
 * placeholder — flows edge-to-edge into its parent (no outer border
 * or rounded container), 10 px uppercase muted-text header, plain
 * `border-t` above the input. Parent handles the surrounding chrome.
 */
export default function ChatLog() {
  const gameId = useGameId();
  const listRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    players,
    displaySeconds,
    draft,
    setDraft,
    handleMessagesScroll,
    handleSubmit,
  } = useGameLog({ gameId, listRef });

  return (
    <div data-testid="game-log" className="flex flex-col h-full min-h-0">
      {/* Header — label on the left, elapsed timer on the right. Timer
           hides when there's no active game (lobby chat renders with no
           gameId while the game hasn't started yet). */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 text-[10px] uppercase tracking-widest text-text-muted">
        <div className="flex items-center gap-1">
          <MessageSquare size={11} /> Chat &amp; log
        </div>
        {gameId != null && (
          <span
            data-testid="game-log-timer"
            className="tabular-nums normal-case tracking-normal"
          >
            {formatElapsed(displaySeconds)}
          </span>
        )}
      </div>

      {/* Messages — scrollable, pinned to bottom by useGameLog unless
           the user has scrolled up. Chat vs event: events drop the
           author prefix and render as italic muted text; chat gets an
           accent-colored author + normal body. */}
      <div
        ref={listRef}
        onScroll={handleMessagesScroll}
        className="scrollable flex-1 min-h-0 overflow-y-auto px-3 py-2 text-xs space-y-1"
      >
        {messages.length === 0 && (
          <div className="italic text-text-muted">no messages</div>
        )}
        {messages.map((m, idx) => {
          const isEvent = m.kind === 'event';
          const name =
            players?.[m.playerId]?.properties.userInfo?.name ?? `p${m.playerId}`;
          if (isEvent) {
            return (
              <div
                key={`${m.timeReceived}-${idx}`}
                className="italic text-text-muted leading-snug break-words"
              >
                {m.message}
              </div>
            );
          }
          return (
            <div
              key={`${m.timeReceived}-${idx}`}
              className="text-text-primary leading-snug break-words"
            >
              <span className="font-semibold text-accent">{name}:</span>{' '}
              <span>{m.message}</span>
            </div>
          );
        })}
      </div>

      {/* Input — submits on Enter via the form's onSubmit. `Say:` label
           kept as an sr-only affordance for keyboard-only users. */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 p-2 border-t border-border-subtle"
      >
        <label htmlFor="game-log-say-input" className="sr-only">
          Say:
        </label>
        <input
          id="game-log-say-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={gameId == null}
          placeholder={gameId == null ? 'Chat unavailable' : 'Say something…'}
          aria-label="game chat input"
          className="w-full bg-bg-base border border-border-subtle rounded-md px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
      </form>
    </div>
  );
}
