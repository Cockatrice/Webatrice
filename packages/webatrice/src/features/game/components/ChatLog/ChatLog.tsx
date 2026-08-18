import { useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { classifyLogTone, type LogSegment, type LogTone } from '@cockatrice/datatrice';

import { ShortcutScope, useShortcut } from '@app/feature-widgets/shortcuts';

import { useGameId } from '../ui/GameIdContext';
import { useHoveredCard } from '../PlayerBox/hoveredCard';
import { useBigCardPreview } from '../PlayerBox/bigCardPreview';

import { formatElapsed, useGameLog } from './useGameLog';

// Per-tone styling for event log lines. Cockatrice desktop uses a fixed
// palette per event kind (green turn banner, per-phase color, red for
// server messages, blue-highlighted numbers). We approximate that:
//   • turn   — emerald + bold  (round-boundary banner)
//   • phase  — sky              (phase-change label)
//   • system — rose italic      (join/leave/concede/deck-load)
//   • action — near-white       (routine card/attr/counter/arrow)
// The per-tone base color sets the "line color"; individual segments
// (card names / numbers) override with their own accent — matching
// Cockatrice's inline highlighting.
const TONE_CLASS: Record<LogTone, string> = {
  turn: 'text-emerald-400 font-semibold',
  phase: 'text-sky-400',
  system: 'text-rose-400 italic',
  action: 'text-text-primary/85',
};

/** Format a wall-clock ms timestamp as `HH:MM:SS` in the user's local
 *  timezone. Mirrors Cockatrice desktop's `QDateTime::currentDateTime()
 *  .toString("hh:mm:ss")` — the log stamps events with the user's real
 *  clock, not the game timer. */
function formatWallClock(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const SEGMENT_CLASS: Record<LogSegment['kind'], string> = {
  plain: '',
  // Player names: semibold + slightly warmer than the base line.
  player: 'font-semibold text-text-primary',
  // Card names: italic accent purple. Matches Cockatrice's `<i>`-wrapped
  // `<a href="card://">` links (italic + blue in desktop). Wired below
  // to the shared preview hover so pointing at a card name in the log
  // shows it in the right-rail preview, just like hovering the card
  // itself on the battlefield.
  card: 'italic text-accent-primary hover:text-accent-primary-hover cursor-pointer underline decoration-dotted underline-offset-2',
  // Numbers: cyan, tabular. Cockatrice desktop highlights every
  // numeric literal (rolls, deltas, PT, counts) in bold blue —
  // makes counter deltas instantly scannable.
  number: 'font-semibold text-cyan-300 tabular-nums',
};

/**
 * Shared chat + event log used both in the pre-game lobby and inside
 * the game screen sidebar. Reads its gameId from `useGameId()` context
 * so both mount sites just render `<ChatLog />` — no prop threading.
 *
 * Event lines are rendered with per-token styling (card names, player
 * names, numbers each get their own accent color) and alternating row
 * backgrounds so consecutive log lines are visually separable.
 */
export default function ChatLog() {
  const gameId = useGameId();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setHoveredCard } = useHoveredCard();
  const { openBigPreview, closeBigPreview } = useBigCardPreview();
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
  } = useGameLog({ gameId, listRef });
  // Composite disabled state — no active game OR spectator-can't-chat.
  const inputDisabled = gameId == null || !canChat;

  // Cockatrice-parity focus-chat shortcut (Shift+Enter). Registered
  // GLOBAL so it fires regardless of route, but only actually mounted
  // when ChatLog is on-screen. Disabled state gates it — focusing a
  // disabled input would be a no-op, but skipping the preventDefault
  // lets Shift+Enter fall through to whatever else is listening.
  useShortcut(
    'chat.focus',
    () => {
      const el = inputRef.current;
      if (!el || inputDisabled) {
        return;
      }
      el.focus();
      el.select();
    },
    { scope: ShortcutScope.GAME, enabled: !inputDisabled },
  );
  const inputTitle = chatDisabledReason ?? undefined;
  const inputPlaceholder = gameId == null
    ? 'Chat unavailable'
    : (chatDisabledReason ?? 'Say something…');

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
           the user has scrolled up. Rows alternate bg to visually
           separate consecutive lines (Cockatrice does the same with
           its zebra-striped log). */}
      <div
        ref={listRef}
        onScroll={handleMessagesScroll}
        className="scrollable flex-1 min-h-0 overflow-y-auto py-1 text-xs"
      >
        {messages.length === 0 && (
          <div className="italic text-text-muted px-3 py-1">no messages</div>
        )}
        {messages.map((m, idx) => {
          const isEvent = m.kind === 'event';
          const rowClass = idx % 2 === 0
            ? 'bg-transparent'
            : 'bg-black/15';
          const name =
            players?.[m.playerId]?.properties.userInfo?.name ?? `p${m.playerId}`;
          // Per-message wall-clock stamp, Cockatrice-style `[HH:MM:SS]`.
          // Matches desktop's `QDateTime::currentDateTime()` — the log
          // is annotated with the user's local clock, not the game
          // elapsed timer (that lives in the header at the top-right).
          const stamp = m.timeReceived
            ? `[${formatWallClock(m.timeReceived)}]`
            : null;
          if (isEvent) {
            const tone = classifyLogTone(m.message);
            return (
              <div
                key={`${m.timeReceived}-${idx}`}
                data-tone={tone}
                className={`px-3 py-0.5 leading-snug break-words ${TONE_CLASS[tone]} ${rowClass}`}
              >
                {stamp && (
                  <span className="text-text-muted font-normal not-italic tabular-nums mr-1.5">
                    {stamp}
                  </span>
                )}
                {m.segments && m.segments.length > 0 ? (
                  m.segments.map((seg, si) => {
                    if (seg.kind === 'card') {
                      return (
                        <span
                          key={si}
                          className={SEGMENT_CLASS.card}
                          onMouseEnter={() => setHoveredCard({ name: seg.text })}
                          onMouseLeave={() => setHoveredCard(null)}
                          onMouseDown={(e) => {
                            // Match Card.tsx: middle-mouse-down opens
                            // the big-preview modal, mouse-up closes it.
                            if (e.button === 1) {
                              e.preventDefault();
                              openBigPreview({ name: seg.text });
                            }
                          }}
                          onMouseUp={(e) => {
                            if (e.button === 1) closeBigPreview();
                          }}
                        >
                          {seg.text}
                        </span>
                      );
                    }
                    return (
                      <span key={si} className={SEGMENT_CLASS[seg.kind]}>
                        {seg.text}
                      </span>
                    );
                  })
                ) : (
                  m.message
                )}
              </div>
            );
          }
          return (
            <div
              key={`${m.timeReceived}-${idx}`}
              className={`px-3 py-0.5 text-text-primary leading-snug break-words ${rowClass}`}
            >
              {stamp && (
                <span className="text-text-muted font-normal tabular-nums mr-1.5">
                  {stamp}
                </span>
              )}
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
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={inputDisabled}
          placeholder={inputPlaceholder}
          // Native browser tooltip on hover — surfaces the disable
          // reason (e.g. "Spectators are not allowed to chat in this
          // game.") when the field is greyed out.
          title={inputTitle}
          aria-label="game chat input"
          aria-disabled={inputDisabled}
          className="w-full bg-bg-base border border-border-subtle rounded-md px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
      </form>
    </div>
  );
}
