import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, Dices, Layers, Plus, RotateCcw, Shuffle, type LucideIcon } from 'lucide-react';

import { cx } from '@app/utils';

import { usePlayerSeatContext } from '../ui/PlayerBoard/PlayerSeatContext';
import { useGameDialogActions } from '../ui/GameDialogActionsContext';
import { useGameReadOnly } from '../ui/GameReadOnlyContext';
import { useGameAffordances } from '../../hooks/useGameAffordances';
import { useGameId } from '../ui/GameIdContext';
import { GAME_FOCUS_RING } from '../ui/focusRing';
import { buildTrayActions, type TrayActionId } from './trayActionList';

const ICON: Record<TrayActionId, LucideIcon> = {
  untapAll: RotateCcw,
  draw: ArrowDownToLine,
  shuffle: Shuffle,
  drawN: Layers,
  rollDie: Dices,
  createToken: Plus,
};

export default function TrayActions() {
  const { t } = useTranslation();
  const gameId = useGameId();
  const readOnly = useGameReadOnly();
  const { canRoll } = useGameAffordances(gameId ?? undefined);
  const { onRequestRollDie } = useGameDialogActions();
  const {
    cardCommands,
    deckCount,
    draw,
    menuShortcut,
    openCreateTokenDialog,
    openDrawCardsPrompt,
    zoneCommands,
  } = usePlayerSeatContext();

  const run: Record<TrayActionId, () => void> = {
    untapAll: () => cardCommands.untapAll(),
    draw: () => draw(1),
    shuffle: () => zoneCommands.shuffleLibrary(),
    drawN: () => openDrawCardsPrompt({ deckSize: deckCount }),
    rollDie: onRequestRollDie,
    createToken: openCreateTokenDialog,
  };
  const actions = buildTrayActions({ canAct: !readOnly, canRoll, deckCount });

  return (
    <div className="grid w-[clamp(176px,16vw,236px)] shrink-0 grid-cols-2 gap-1" role="group" aria-label={t('BoardTray.actions')}>
      {actions.map(({ id, shortcut, disabled }) => {
        const Icon = ICON[id];
        const keys = menuShortcut(shortcut);
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={run[id]}
            aria-keyshortcuts={keys.keyShortcuts || undefined}
            className={cx(
              'flex min-h-0 flex-col items-start justify-center gap-0.5 rounded-ui-sm border border-border-subtle bg-bg-elevated/60 px-2',
              'text-[12px] font-medium text-text-primary hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-45',
              'board-motion transition-colors',
              GAME_FOCUS_RING,
            )}
          >
            <span className="flex items-center gap-1.5">
              <Icon size={14} className="text-text-secondary" aria-hidden />
              {t(`BoardTray.action.${id}`)}
            </span>
            {keys.shortcut && <span className="font-mono text-[10px] text-text-muted">{keys.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}
