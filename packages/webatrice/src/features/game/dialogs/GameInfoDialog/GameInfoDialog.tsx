import { memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { useGameId } from '../../components/ui/GameIdContext';
import { useGameDialogsContext } from '../../components/ui/GameDialogsContext';
import { useCurrentGame } from '../../hooks/useCurrentGame';
import { playerName } from '../../utils/playerName';

function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Game info modal — read-only summary of the current game (id, name,
 * description, elapsed time, host) + the seated players with role tags.
 * Portal-rendered so it floats above the play area; Escape or the
 * backdrop click dismisses.
 *
 * Styled in Tailwind to match the other modals in the play area
 * (SetLifeModal, ViewNCardsModal). Preserves the `game-info-dialog__player-name`
 * class + `<li>` structure the tests key off (see GameInfoDialog.spec.tsx).
 */
function GameInfoDialog() {
  const { gameInfoOpen: isOpen, closeGameInfo: onClose } = useGameDialogsContext();
  const gameId = useGameId();
  const { game } = useCurrentGame(gameId);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Local 1Hz ticker for the Elapsed row — mirrors the ChatLog
  // header timer (useGameLog.ts:44-59). Server sends `secondsElapsed`
  // via Event_GameStateChanged at its own cadence; between ticks we
  // increment locally so the timer counts up smoothly rather than
  // freezing. Resyncs to the server value whenever it updates so we
  // never drift too far.
  const serverSeconds = game?.secondsElapsed ?? 0;
  const [displaySeconds, setDisplaySeconds] = useState(serverSeconds);
  useEffect(() => {
    setDisplaySeconds(serverSeconds);
  }, [serverSeconds]);
  useEffect(() => {
    // Only tick while the dialog is open — no reason to burn a timer
    // in the background when nobody's looking at it.
    if (!isOpen) return undefined;
    const id = window.setInterval(() => {
      setDisplaySeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isOpen]);

  if (!game || !isOpen) {
    return null;
  }

  const description = game.info?.description ?? '';
  const name = game.info?.description ?? `Game ${game.info?.gameId ?? gameId ?? '—'}`;
  const players = Object.values(game.players);

  const host = players.find((p) => p.properties.playerId === game.hostId);
  const hostLabel = host ? playerName(host) : `p${game.hostId}`;

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Game ID', value: String(game.info?.gameId ?? gameId ?? '—') },
    { label: 'Name', value: name || '(no description)' },
    { label: 'Description', value: description || '(none)' },
    { label: 'Started', value: game.started ? 'Yes' : 'No' },
    { label: 'Elapsed', value: formatElapsed(displaySeconds) },
    { label: 'Host', value: hostLabel },
  ];

  return createPortal(
    <div
      className="GameInfoDialog fixed inset-0 z-[500] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Game info"
    >
      {/* Backdrop click closes. Slight blur + dim so the play area
          behind reads as "paused" while the modal is up. */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-lg bg-bg-surface border border-border-subtle shadow-glow overflow-hidden">
        {/* Header — title + close X. Same padding/border rhythm as
            the other Tailwind modals (SetLifeModal, ViewNCardsModal). */}
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
          <h2 className="font-modern text-base font-semibold text-text-primary">
            Game info
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="close game info"
            className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Metadata — label / value pairs. Two-column grid keeps
            labels aligned; tabular-nums on the value column so the
            elapsed timer doesn't jitter. */}
        <dl className="px-4 py-3 grid grid-cols-[7rem_1fr] gap-y-1.5 gap-x-3 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="text-text-muted font-medium">{r.label}</dt>
              <dd className="text-text-primary tabular-nums truncate" title={r.value}>
                {r.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* Players section — same header rhythm as the fancy sidebar's
            "Players" strip (uppercase-tracking micro-label). Roles
            render as small pills matching the Leave / Concede buttons. */}
        <div className="border-t border-border-subtle px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-2">
            Players
          </div>
          <ul className="flex flex-col gap-1.5">
            {players.map((p) => {
              const pid = p.properties.playerId;
              const pname = playerName(p);
              const tags: string[] = [];
              if (pid === game.hostId) tags.push('host');
              if (p.properties.spectator) tags.push('spectator');
              if (p.properties.judge) tags.push('judge');
              if (pid === game.localPlayerId) tags.push('you');
              return (
                <li
                  key={pid}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="game-info-dialog__player-name font-semibold text-text-primary truncate">
                    {pname}
                  </span>
                  {tags.length > 0 && (
                    <span className="inline-flex gap-1">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-bg-elevated border border-border-subtle text-text-secondary"
                        >
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer — single Close button, matches the other modals'
            right-aligned action row. */}
        <div className="px-4 py-3 border-t border-border-subtle flex justify-end">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default memo(GameInfoDialog);
