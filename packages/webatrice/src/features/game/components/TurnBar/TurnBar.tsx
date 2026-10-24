import { useTranslation } from 'react-i18next';

import { Button } from '@app/components';
import { useMenuShortcut } from '@app/feature-widgets/shortcuts';
import { cx } from '@app/utils';

import { formatElapsed } from '../ChatLog/useGameLog';
import PhaseTrack from '../PhaseTrack/PhaseTrack';
import { useCardPreviewActions } from '../ui/CardPreviewContext';
import { useGameId } from '../ui/GameIdContext';
import { useGameReadOnly } from '../ui/GameReadOnlyContext';
import { GAME_FOCUS_RING } from '../ui/focusRing';
import { useTurnBar } from './useTurnBar';

export default function TurnBar() {
  const { t } = useTranslation();
  const gameId = useGameId();
  const readOnly = useGameReadOnly();
  const { activePlayerName, elapsedSeconds, stack, canPassTurn, handlePass } = useTurnBar(gameId ?? undefined);
  const { setHoveredCard, showCardInfo } = useCardPreviewActions();
  const passKeys = useMenuShortcut()('game.endTurn');

  return (
    <div
      data-testid="turn-bar"
      className={cx(
        'game__turnbar flex h-11 min-w-0 shrink-0 items-center gap-2.5 whitespace-nowrap border-b border-border-subtle',
        'bg-bg-surface px-2.5',
      )}
    >
      <div className="flex min-w-0 shrink-0 flex-col leading-tight">
        <span className="truncate text-[12.5px] font-semibold text-text-primary" data-testid="turn-bar-active">
          {activePlayerName ? t('TurnBar.whoseTurn', { name: activePlayerName }) : t('TurnBar.noTurn')}
        </span>
        {gameId != null && !readOnly && (
          <span className="text-[10.5px] tabular-nums text-text-muted" title={t('TurnBar.elapsedTitle')}>
            {formatElapsed(elapsedSeconds)}
          </span>
        )}
      </div>
      <PhaseTrack />
      <div className="ml-auto flex min-w-0 items-center gap-1.5 overflow-hidden" role="group" aria-label={t('TurnBar.stack')}>
        <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          {t('TurnBar.stack')}
        </span>
        {stack.length === 0 && (
          <span className="text-[11.5px] text-text-muted">{t('TurnBar.stackEmpty')}</span>
        )}
        {stack.map((item) => (
          <button
            key={item.key}
            type="button"
            onMouseEnter={() => setHoveredCard(item.card)}
            onMouseLeave={() => setHoveredCard(null)}
            onFocus={() => setHoveredCard(item.card)}
            onClick={() => showCardInfo(item.card)}
            title={t('TurnBar.stackItem', {
              card: item.card.name,
              name: item.playerName ?? t('GameLog.player.number', { id: item.playerId }),
            })}
            className={cx(
              'flex h-7 min-w-0 max-w-[240px] items-center gap-1.5 rounded-ui-sm border border-accent/50 bg-bg-elevated pl-1.5 pr-1.5',
              'text-[12px] font-medium text-text-primary hover:border-accent board-motion transition-colors',
              GAME_FOCUS_RING,
            )}
          >
            <span className="max-w-[72px] shrink truncate text-[10.5px] text-text-muted">{item.playerName}</span>
            <span className="truncate">{item.card.name}</span>
          </button>
        ))}
      </div>
      {!readOnly && (
        <Button
          size="sm"
          variant="primary"
          onClick={handlePass}
          disabled={!canPassTurn}
          title={canPassTurn ? t('PhaseTrack.passTitle') : t('TurnBar.passDisabled')}
          aria-keyshortcuts={passKeys.keyShortcuts || undefined}
          className="shrink-0 board-motion"
        >
          {t('TurnBar.pass')}
          {passKeys.shortcut && <span className="font-mono text-[10px] opacity-80">{passKeys.shortcut}</span>}
        </Button>
      )}
    </div>
  );
}
