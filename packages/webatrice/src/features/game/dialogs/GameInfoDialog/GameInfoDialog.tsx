import { memo, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DialogShell } from '@app/dialogs';

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

type PlayerTag = 'host' | 'spectator' | 'judge' | 'you';

function GameInfoDialog() {
  const { t } = useTranslation();
  const { gameInfoOpen: isOpen, closeGameInfo: onClose } = useGameDialogsContext();
  const gameId = useGameId();
  const { game } = useCurrentGame(gameId);
  const playersHeadingId = useId();

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
    if (!isOpen) {
      return undefined;
    }
    const id = window.setInterval(() => {
      setDisplaySeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isOpen]);

  if (!game) {
    return null;
  }

  const description = game.info?.description ?? '';
  const id = String(game.info?.gameId ?? gameId ?? '—');
  const name = game.info?.description ?? t('GameInfoDialog.gameName', { id });
  const players = Object.values(game.players);

  const host = players.find((p) => p.properties.playerId === game.hostId);
  const hostLabel = host ? playerName(host, t) : t('GameLog.player.number', { id: game.hostId });

  const rows: Array<{ label: string; value: string }> = [
    { label: t('GameInfoDialog.row.gameId'), value: id },
    { label: t('GameInfoDialog.row.name'), value: name || t('GameInfoDialog.noDescription') },
    { label: t('GameInfoDialog.row.description'), value: description || t('GameInfoDialog.none') },
    { label: t('GameInfoDialog.row.started'), value: game.started ? t('GameInfoDialog.yes') : t('GameInfoDialog.no') },
    { label: t('GameInfoDialog.row.elapsed'), value: formatElapsed(displaySeconds) },
    { label: t('GameInfoDialog.row.host'), value: hostLabel },
  ];

  return (
    <DialogShell
      isOpen={isOpen}
      handleClose={onClose}
      title={t('GameInfoDialog.title')}
      className="GameInfoDialog"
      footer={(
        <button
          type="button"
          onClick={onClose}
          data-autofocus
          className={[
            'px-3 py-1.5 rounded-md text-sm font-semibold bg-accent',
            'text-on-accent hover:bg-accent-hover shadow-glow board-motion transition-colors',
          ].join(' ')}
        >
          {t('Common.action.close')}
        </button>
      )}
    >
      {/* Metadata — label / value pairs. Two-column grid keeps
          labels aligned; tabular-nums on the value column so the
          elapsed timer doesn't jitter. */}
      <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 gap-x-3 text-sm">
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
      <section className="mt-3 pt-3 border-t border-border-subtle" aria-labelledby={playersHeadingId}>
        <h3 id={playersHeadingId} className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-2">
          {t('GameInfoDialog.players')}
        </h3>
        <ul className="flex flex-col gap-1.5">
          {players.map((p) => {
            const pid = p.properties.playerId;
            const pname = playerName(p, t);
            const tags: PlayerTag[] = [];
            if (pid === game.hostId) {
              tags.push('host');
            }
            if (p.properties.spectator) {
              tags.push('spectator');
            }
            if (p.properties.judge) {
              tags.push('judge');
            }
            if (pid === game.localPlayerId) {
              tags.push('you');
            }
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
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className={[
                          'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                          'tracking-wide bg-bg-elevated border border-border-subtle text-text-secondary',
                        ].join(' ')}
                      >
                        {t(`GameInfoDialog.tag.${tag}`)}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </DialogShell>
  );
}

export default memo(GameInfoDialog);
