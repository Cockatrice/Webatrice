import { memo } from 'react';

import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { cx } from '@app/utils';

import { useGameId } from '../../ui/GameIdContext';

import './PlayerList.css';

// See .github/instructions/webatrice-game.instructions.md#servatrice-game-event-quirks.
function pingCssColor(pingSeconds: number | undefined): string {
  if (pingSeconds == null || pingSeconds < 0) {
    return '#000';
  }
  const max = 10;
  const ratio = Math.min(pingSeconds, max) / max;
  const hue = 120 * (1 - ratio);
  return `hsl(${hue}, 100%, 50%)`;
}

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
    <div className="player-list" data-testid="player-list">
      <div className="player-list__heading">Players</div>
      <ul className="player-list__items">
        {entries.length === 0 && (
          <li className="player-list__empty">no players</li>
        )}
        {entries.map((p) => {
          const pid = p.properties.playerId;
          const name = p.properties.userInfo?.name ?? '(unknown)';
          const isActive = pid === activePlayerId;
          const isHost = pid === hostId;
          const sideboardLocked = p.properties.sideboardLocked ?? false;
          const pingSeconds = p.properties.pingSeconds;
          const pingLabel = `ping ${pingSeconds ?? '?'}s`;
          return (
            <li
              key={pid}
              className={cx('player-list__item', {
                'player-list__item--active': isActive,
                'player-list__item--conceded': p.properties.conceded,
              })}
              data-testid={`player-list-item-${pid}`}
            >
              <span
                className={cx('player-list__indicator', {
                  'player-list__indicator--active': isActive,
                })}
              />
              {isHost && (
                <span
                  className="player-list__host-badge"
                  aria-label="host"
                  title="Host"
                >
                  ♛
                </span>
              )}
              <span className="player-list__name">{name}</span>
              {sideboardLocked && (
                <span
                  className="player-list__sideboard-lock"
                  aria-label="sideboard locked"
                  title="Sideboard locked"
                >
                  🔒
                </span>
              )}
              <span
                className="player-list__ping-dot"
                style={{ background: pingCssColor(pingSeconds) }}
                aria-label={pingLabel}
                title={pingLabel}
                data-testid={`ping-dot-${pid}`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Memoized so it skips re-render when unrelated game state changes (e.g. card hover/preview);
// it still updates when the players map changes (joins/leaves, ping, ready, conceded).
export default memo(PlayerList);
