import { ZoneName } from '@cockatrice/sockatrice';
import { memo } from 'react';

import { cx } from '@app/utils';
import { ServerInfo_Counter } from '@cockatrice/sockatrice/generated';
import ZoneStack from '../../ui/ZoneStack/ZoneStack';
import { useGameInteraction } from '../../ui/GameInteractionContext';
import { useCanActFor, useCardVisualState } from '../../ui/CardVisualStateContext';
import { useGameIdRequired } from '../../ui/GameIdContext';
import { useBoardCell } from '../../ui/BoardCellContext';
import { makePlayerKey, useRegisterCardRef } from '../../../utils/CardRegistry/CardRegistryContext';

import { counterCssColor, usePlayerInfoPanel } from './usePlayerInfoPanel';

import './PlayerInfoPanel.css';

// All four zones render as landscape thumbs in the info rail. Hand sits
// between Deck and Graveyard to match desktop's hand counter placement.
const ZONE_ROWS: Array<{ name: string; label: string; rotated?: boolean }> = [
  { name: ZoneName.DECK, label: 'Deck', rotated: true },
  { name: ZoneName.HAND, label: 'Hand', rotated: true },
  { name: ZoneName.GRAVE, label: 'Graveyard', rotated: true },
  { name: ZoneName.EXILE, label: 'Exile', rotated: true },
];

export interface PlayerInfoPanelProps {
  onContextMenu?: (event: React.MouseEvent) => void;
  onPlayerClick?: (playerId: number) => boolean;
}

function PlayerInfoPanel({
  onContextMenu,
  onPlayerClick,
}: PlayerInfoPanelProps) {
  const { playerId } = useBoardCell();
  const gameId = useGameIdRequired();
  const { onZoneClick, onZoneContextMenu } = useGameInteraction();
  const { arrowTargetKey } = useCardVisualState();
  const canEdit = useCanActFor()(playerId);
  const { properties, isHost, lifeCounter, otherCounters, handleIncrement } = usePlayerInfoPanel({
    gameId,
    playerId,
  });
  const registerLifeCounterRef = useRegisterCardRef(makePlayerKey(playerId));
  const isArrowTarget = arrowTargetKey === makePlayerKey(playerId);
  const handleHeaderClickCapture = (e: React.MouseEvent) => {
    if (onPlayerClick && onPlayerClick(playerId)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  if (!properties) {
    return <div className="player-info-panel player-info-panel--empty" />;
  }

  const name = properties.userInfo?.name ?? '(unknown)';
  const conceded = properties.conceded;
  const ready = properties.readyStart;

  const counterHandlers = (c: ServerInfo_Counter) =>
    canEdit
      ? {
        role: 'button' as const,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          handleIncrement(c.id, +1);
        },
        // stopPropagation prevents the panel's onContextMenu (player menu)
        // from firing when the user right-clicks a counter to decrement.
        onContextMenu: (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          handleIncrement(c.id, -1);
        },
      }
      : {};

  const renderCounterCircle = (c: ServerInfo_Counter, modifier?: string) => (
    <li
      key={c.id}
      className={cx('player-info-panel__counter', modifier)}
      data-testid={`counter-${c.id}`}
      style={{ background: counterCssColor(c) }}
      title={c.name}
      aria-label={`${c.name}: ${c.count}`}
      {...counterHandlers(c)}
    >
      <span className="player-info-panel__counter-value">{c.count}</span>
    </li>
  );

  return (
    <div
      className="player-info-panel"
      data-testid={`player-info-${playerId}`}
      onContextMenu={onContextMenu}
    >
      <div
        className={cx('player-info-panel__header', {
          'player-info-panel__header--arrow-target': isArrowTarget,
        })}
        data-arrow-target-kind="player"
        data-arrow-target-player-id={playerId}
        onClickCapture={handleHeaderClickCapture}
      >
        {isHost && (
          <span
            className="player-info-panel__host-badge"
            aria-label="host"
            title="Host"
          >
            ♛
          </span>
        )}
        <span className="player-info-panel__name">{name}</span>
        {lifeCounter && (
          <ul className="player-info-panel__life-slot" ref={registerLifeCounterRef}>
            {renderCounterCircle(lifeCounter, 'player-info-panel__counter--life')}
          </ul>
        )}
      </div>

      {conceded && <div className="player-info-panel__flag">Conceded</div>}
      {!conceded && ready && <div className="player-info-panel__flag player-info-panel__flag--ready">Ready</div>}

      <div className="player-info-panel__body">
        <ul className="player-info-panel__counters">
          {otherCounters.map((c) => renderCounterCircle(c))}
        </ul>
        <div className="player-info-panel__zones">
          {ZONE_ROWS.map((z) => {
            // Hand is context-menu only: desktop's hand counter doesn't open
            // a zone view on left-click, and HandZone already renders the cards.
            const clickHandler =
              z.name !== ZoneName.HAND
                ? (name: string) => onZoneClick(playerId, name)
                : undefined;
            return (
              <ZoneStack
                key={z.name}
                zoneName={z.name}
                label={z.label}
                rotated={z.rotated}
                onClick={clickHandler}
                onContextMenu={(name, e) => onZoneContextMenu(playerId, name, e)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Memoized + subscribes only to `properties`/`counters` (stable across this player's card
// mutations), so tapping a creature no longer re-renders the player rail or its ZoneStacks.
export default memo(PlayerInfoPanel);
