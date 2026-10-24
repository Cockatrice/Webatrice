import { Crown, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@app/components';
import BracketBadge from './BracketBadge';

export default function PlayerRow({
  playerName,
  isHost,
  ready,
  hasDeck,
  bracket,
  deckName,
  showKick,
  onKick,
}: {
  playerName: string;
  isHost: boolean;
  ready: boolean;
  hasDeck: boolean;
  /** Commander bracket 1..5 for this player's selected deck when known.
   *  Currently only populated for the local player (Cockatrice's wire
   *  protocol doesn't expose enough for us to know a remote player's
   *  bracket without extra channels). */
  bracket?: number;
  /** Name of the selected deck. Same caveat as `bracket` — only known
   *  for the local player; remote players fall back to the generic
   *  "Deck submitted" text. */
  deckName?: string;
  showKick: boolean;
  onKick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={[
        'flex items-center gap-4 px-4 py-3 rounded-lg border board-motion transition-colors',
        ready
          ? 'bg-emerald-500/5 border-emerald-500/40'
          : 'bg-bg-surface border-border-subtle',
      ].join(' ')}
    >
      <Avatar name={playerName} size={44} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-semibold text-text-primary truncate">{playerName}</span>
          {isHost && <Crown size={14} className="text-warning shrink-0" aria-label={t('PlayerList.host')} />}
          {ready && (
            <CheckCircle2
              size={18}
              className="text-success shrink-0"
              aria-label={t('GameLobby.player.ready')}
            />
          )}
        </div>
        <div className="text-xs text-text-muted mt-0.5 truncate flex items-center gap-1.5">
          {ready ? (
            deckName ? (
              <>
                <span className="text-text-secondary truncate">
                  {t('GameLobby.player.readyWithDeck', { name: deckName })}
                </span>
                {bracket != null && <BracketBadge level={bracket} />}
              </>
            ) : (
              <span>{t('GameLobby.player.ready')}</span>
            )
          ) : hasDeck ? (
            deckName ? (
              <>
                <span className="text-text-secondary truncate">
                  {t('GameLobby.player.waitingWithDeck', { name: deckName })}
                </span>
                {bracket != null && <BracketBadge level={bracket} />}
              </>
            ) : (
              <span>{t('GameLobby.player.deckSubmittedWaiting')}</span>
            )
          ) : (
            <span className="italic">{t('GameLobby.player.choosingDeck')}</span>
          )}
        </div>
      </div>
      {showKick && (
        <button
          type="button"
          onClick={onKick}
          className={[
            'text-xs px-2 py-1 rounded text-text-muted hover:text-danger',
            'hover:bg-red-500/10 border border-transparent hover:border-red-500/40 board-motion transition-colors',
          ].join(' ')}
          title={t('PlayerListContextMenu.kick')}
        >
          {t('GameLobby.player.kick')}
        </button>
      )}
    </div>
  );
}
