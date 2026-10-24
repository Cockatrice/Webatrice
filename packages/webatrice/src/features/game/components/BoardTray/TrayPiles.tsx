import { useTranslation } from 'react-i18next';
import { Copy, Layers, Skull, Sparkles, type LucideIcon } from 'lucide-react';

import { cx } from '@app/utils';

import { usePlayerSeatContext } from '../ui/PlayerBoard/PlayerSeatContext';
import { useCardPreviewActions } from '../ui/CardPreviewContext';
import { useGameDialogActions } from '../ui/GameDialogActionsContext';
import { useGameReadOnly } from '../ui/GameReadOnlyContext';
import { useSeatPiles, type PileName, type SeatPile } from '../ui/ZoneStack/useSeatPiles';
import { GAME_FOCUS_RING } from '../ui/focusRing';

const ICON: Record<PileName, LucideIcon> = { library: Layers, graveyard: Skull, exile: Sparkles };

const ROW_CLASS = cx(
  'flex h-[40px] min-h-0 w-full items-center gap-2 rounded-ui-sm border border-border-subtle bg-bg-sunken px-2',
  'text-[12px] text-text-secondary hover:border-accent/60 board-motion transition-colors select-none',
  GAME_FOCUS_RING,
);

function PileRow({ pile, playerId }: { pile: SeatPile; playerId: number }) {
  const { setHoveredCard } = useCardPreviewActions();
  const Icon = ICON[pile.name];
  return (
    <>
      <div
        ref={pile.ref}
        data-pile-count={pile.count}
        data-drag-source
        data-arrow-anchor-owner={pile.arrowAnchorZone ? String(playerId) : undefined}
        data-arrow-anchor-zone={pile.arrowAnchorZone}
        {...pile.pileProps}
        onPointerDown={pile.onPointerDown}
        onMouseEnter={pile.topCard ? () => setHoveredCard(pile.topCard) : undefined}
        title={pile.label}
        className={ROW_CLASS}
        style={{
          cursor: pile.onPointerDown ? 'grab' : undefined,
          touchAction: pile.onPointerDown ? 'none' : undefined,
        }}
      >
        <Icon size={13} className="text-text-muted" aria-hidden />
        <span className="flex-1 truncate text-left">{pile.zoneLabel}</span>
        <span className="font-semibold tabular-nums text-text-primary">{pile.count}</span>
      </div>
      {pile.popup}
    </>
  );
}

export default function TrayPiles() {
  const { t } = useTranslation();
  const readOnly = useGameReadOnly();
  const { playerId, zones, menuShortcut } = usePlayerSeatContext();
  const { library, graveyard, exile } = useSeatPiles();
  const { onRequestViewSideboard } = useGameDialogActions();
  const sideboardKeys = menuShortcut('game.viewSideboard');
  const sideboardCount = zones.sideboard.cardCount ?? 0;
  const sideboardLabel = t('ZoneStack.pile', { zone: t('BoardTray.sideboard'), count: sideboardCount });

  return (
    <div className="flex w-[clamp(104px,9vw,124px)] shrink-0 flex-col gap-1">
      <PileRow pile={library} playerId={playerId} />
      <PileRow pile={graveyard} playerId={playerId} />
      <PileRow pile={exile} playerId={playerId} />
      <button
        type="button"
        onClick={onRequestViewSideboard}
        disabled={readOnly}
        title={sideboardLabel}
        aria-label={sideboardLabel}
        aria-keyshortcuts={sideboardKeys.keyShortcuts || undefined}
        className={cx(ROW_CLASS, 'disabled:cursor-not-allowed disabled:opacity-45')}
      >
        <Copy size={13} className="text-text-muted" aria-hidden />
        <span className="flex-1 truncate text-left">{t('BoardTray.sideboard')}</span>
        <span className="font-semibold tabular-nums text-text-primary">{sideboardCount}</span>
      </button>
    </div>
  );
}
