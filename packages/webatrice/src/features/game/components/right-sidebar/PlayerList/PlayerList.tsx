import { memo } from 'react';
import { Crown, Eye, User } from 'lucide-react';

import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

import { useGameId } from '../../ui/GameIdContext';

/**
 * Right-rail player list — one row per seat.
 *
 * Ports fancy webatrice's PlayerRow visual: avatar circle (accent
 * gradient fallback since og's protocol carries no avatar URLs) plus
 * name + host crown icon on the top line and a small "Player" /
 * "Spectator" / "Judge" role tag underneath. The row highlights when
 * it's this player's turn (accent-tinted left ring) so the active
 * seat stays obvious at a glance.
 *
 * Data comes from the same Redux selectors og's game feature already
 * populates — this component only changes what pixels those rows
 * paint. Fancy-only signals (bracket badge, ping dot, sideboard lock,
 * conceded banner) are omitted for now because they're either not on
 * the wire in game state (bracket) or land in a follow-up polish
 * slice (ping / concede / sideboard). This is a visual port; wiring
 * behaviour we can add back once the shape settles.
 */
function PlayerList() {
  const gameId = useGameId();
  const players = useAppSelector((state) =>
    gameId != null ? games.Selectors.getPlayers(state, gameId) : undefined,
  );
  const activePlayerId = useAppSelector((state) =>
    gameId != null ? games.Selectors.getActivePlayerId(state, gameId) : undefined,
  );
  const hostId = useAppSelector((state) =>
    gameId != null ? games.Selectors.getHostId(state, gameId) : undefined,
  );

  const entries = players ? Object.values(players) : [];

  return (
    <ul data-testid="player-list" className="pb-1">
      {entries.length === 0 && (
        <li className="px-3 py-2 text-xs italic text-text-muted">no players</li>
      )}
      {entries.map((p) => {
        const pid = p.properties.playerId;
        const name = p.properties.userInfo?.name ?? '(unknown)';
        const isActive = pid === activePlayerId;
        const isHost = pid === hostId;
        const isSpectator = !!p.properties.spectator;
        const isJudge = !!p.properties.judge;
        const isConceded = !!p.properties.conceded;
        const roleLabel = isJudge
          ? 'Judge'
          : isSpectator
            ? 'Spectator'
            : isConceded
              ? 'Conceded'
              : 'Player';
        return (
          <li
            key={pid}
            data-testid={`player-list-item-${pid}`}
            className={[
              'flex items-center gap-2 px-3 py-2 transition-colors',
              isActive ? 'bg-accent/10' : 'hover:bg-bg-elevated',
            ].join(' ')}
          >
            {/* Avatar — accent gradient fallback (og's protocol doesn't
                 carry avatar URLs today). Same 28 × 28 circle as fancy. */}
            <div
              className={[
                'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
                isConceded
                  ? 'bg-bg-elevated border border-border-subtle'
                  : 'bg-gradient-to-br from-accent-secondary to-accent',
              ].join(' ')}
            >
              <User size={12} className="text-white" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 min-w-0">
                <span
                  className={[
                    'text-sm font-medium truncate',
                    isSpectator || isJudge || isConceded
                      ? 'text-text-muted'
                      : 'text-text-primary',
                  ].join(' ')}
                >
                  {name}
                </span>
                {isHost && (
                  <Crown
                    size={11}
                    className="text-yellow-400 shrink-0"
                    aria-label="Host"
                  />
                )}
              </div>
              <div className="text-[10px] text-text-muted inline-flex items-center gap-1">
                {(isSpectator || isJudge) && <Eye size={10} />}
                {roleLabel}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Memoized so it skips re-render when unrelated game state changes
// (e.g. card hover / preview); still updates when the players map
// changes (joins / leaves, host swap, ready, conceded).
export default memo(PlayerList);
