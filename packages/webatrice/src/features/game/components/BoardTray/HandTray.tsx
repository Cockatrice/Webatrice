import { useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Hand } from 'lucide-react';

import { isContextMenuKey, type MenuAnchor } from '@app/components';
import { cx } from '@app/utils';

import { ContextMenuPopup, type ContextMenuItem } from '../context-menus/ContextMenu/ContextMenu';
import { usePlayerSeatContext } from '../ui/PlayerBoard/PlayerSeatContext';
import { useSeatCardFocus } from '../ui/PlayerBoard/useSeatCardFocus';
import { useHorizontalWheelScroll } from '../../hooks/useHorizontalWheelScroll';
import HandCardTile from '../ui/HandZone/HandCardTile';
import { cardLabel } from '../ui/SeatCard/cardLabel';
import ZoneBackground from '../ui/ZoneBackground/ZoneBackground';
import { GAME_FOCUS_RING } from '../ui/focusRing';
import type { PlayerCardViewModel } from '../ui/PlayerBoard/playerBoard.types';
import TrayActions from './TrayActions';
import TrayPiles from './TrayPiles';

const HEADER_BUTTON_CLASS = cx(
  'inline-flex h-6 items-center gap-1 rounded-ui-sm px-2 text-[11.5px] font-medium text-text-secondary',
  'hover:bg-bg-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-45',
  'board-motion transition-colors',
  GAME_FOCUS_RING,
);

function HeaderMenuButton({
  items,
  label,
  menuLabel,
  title,
  children,
  className,
  buttonRef,
}: {
  items: readonly ContextMenuItem[];
  label?: string;
  menuLabel: string;
  title?: string;
  children: ReactNode;
  className?: string;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const localRef = useRef<HTMLButtonElement | null>(null);
  const ref = buttonRef ?? localRef;
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const openBelow = (button: HTMLElement) => setAnchor({ rect: button.getBoundingClientRect(), placement: 'below' });
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={title ?? label}
        aria-haspopup="menu"
        aria-expanded={anchor != null}
        onClick={(e) => (anchor ? setAnchor(null) : openBelow(e.currentTarget))}
        onContextMenu={(e: MouseEvent<HTMLButtonElement>) => {
          e.preventDefault();
          if (e.clientX === 0 && e.clientY === 0) {
            openBelow(e.currentTarget);
          } else {
            setAnchor({ x: e.clientX, y: e.clientY });
          }
        }}
        onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
          if (isContextMenuKey(e)) {
            e.preventDefault();
            openBelow(e.currentTarget);
          }
        }}
        className={cx(HEADER_BUTTON_CLASS, className)}
      >
        {children}
      </button>
      {anchor && (
        <ContextMenuPopup items={items} anchor={anchor} label={menuLabel} onClose={() => setAnchor(null)} triggerRef={ref} />
      )}
    </>
  );
}

export default function HandTray() {
  const { t } = useTranslation();
  const {
    cardMetaByName,
    handDisplayList,
    handMenuItems,
    handRef,
    handSize,
    handZoneRef,
    isDragging,
    menuOwnerId,
    name,
    onCardDoubleClick,
    onPointerDownBox,
    openSeatCardMenu,
    playerId,
    revealHandItems,
    selection,
    sortHandItems,
    startSeatCardDrag,
  } = usePlayerSeatContext();
  const keysHintId = useId();
  useHorizontalWheelScroll(handRef);
  const { cardProps } = useSeatCardFocus('hand', {
    cards: handDisplayList,
    orientation: 'horizontal',
    labelOf: (c) => cardLabel(t, { name: c.name }),
    previewOf: (c) => ({ name: c.name, scryfallId: c.scryfallId || cardMetaByName.get(c.name)?.scryfallId }),
  });
  const handButtonLabel = t('HandZone.button', { count: handSize });

  const renderCard = (c: PlayerCardViewModel) => (
    <HandCardTile
      key={c.id}
      card={c}
      ownerId={playerId}
      scryfallId={c.scryfallId || cardMetaByName.get(c.name)?.scryfallId}
      pt={cardMetaByName.get(c.name)?.pt}
      dragging={isDragging(c.id, 'hand')}
      selected={selection?.zone === 'hand' && selection.ids.has(c.id)}
      focusProps={cardProps(c)}
      onPointerDown={(e) => startSeatCardDrag(e, c, 'hand', handDisplayList)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openSeatCardMenu({ kind: 'hand', playerId: menuOwnerId, cardId: c.id, x: e.clientX, y: e.clientY });
      }}
      onDoubleClick={(e) => onCardDoubleClick('hand', c, e)}
    />
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 gap-2" onPointerDown={onPointerDownBox}>
      <section
        aria-label={t('BoardTray.yourHand')}
        className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col rounded-ui"
        data-tray-flex
      >
        <ZoneBackground zone="hand" />
        <header className="flex h-6 shrink-0 items-center gap-2 px-1">
          <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            {t('BoardTray.handHeading', { count: handSize })}
          </span>
          <span className="ml-auto flex items-center gap-1">
            <HeaderMenuButton items={sortHandItems} menuLabel={t('HandMenu.sort')}>
              {t('BoardTray.sort')}
              <ChevronDown size={12} aria-hidden />
            </HeaderMenuButton>
            <HeaderMenuButton items={revealHandItems} menuLabel={t('HandMenu.reveal')}>
              {t('BoardTray.reveal')}
              <ChevronDown size={12} aria-hidden />
            </HeaderMenuButton>
            <HeaderMenuButton items={handMenuItems} label={handButtonLabel} menuLabel={t('HandZone.menu')}>
              <Hand size={13} aria-hidden />
              <span className="tabular-nums">{handSize}</span>
            </HeaderMenuButton>
          </span>
        </header>
        <span id={keysHintId} hidden>{t('PlayerBoard.cardKeys')}</span>
        <div
          ref={handZoneRef}
          data-testid={`hand-zone-${playerId}`}
          role="listbox"
          aria-multiselectable
          aria-orientation="horizontal"
          aria-label={t('PlayerBoard.hand', { name, count: handSize })}
          aria-describedby={keysHintId}
          tabIndex={-1}
          className="flex min-h-0 flex-1 items-end gap-1.5 overflow-x-auto overflow-y-hidden px-1 pb-1"
        >
          {handDisplayList.map(renderCard)}
        </div>
      </section>
      <TrayPiles />
      <TrayActions />
    </div>
  );
}
