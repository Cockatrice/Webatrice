import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, ChevronDown, CircleAlert, Crown } from 'lucide-react';

import { isContextMenuKey, ManaSymbols, type MenuAnchor } from '@app/components';
import type { DeckCategory } from '@app/types';

import type { DeckRowDensity } from '../../deckEditorLayout';
import type { CardLegality } from '../../deckLegality';
import type { DeckCardRowProps as GridRowProps } from '../../hooks/useDeckCardGrid';
import type { DeckCard } from '../../types';
import { DeckRowActionsMenu } from './DeckRowActionsMenu';

export interface DeckCardRowProps {
  card: DeckCard;
  selected?: boolean;
  onSelect: () => void;
  onPreview?: (active: boolean) => void;
  onInc: (delta: number) => void;
  onDelete: () => void;
  onSetCategory: (category: DeckCategory) => void;
  onSetCommander: (isCommander: boolean) => void;
  onChangePrinting: () => void;
  onShowDetails?: () => void;
  isMtg: boolean;
  isCommander: boolean;
  readOnly?: boolean;
  legality?: CardLegality;
  rowProps?: GridRowProps;
  density?: DeckRowDensity;
}

export function DeckCardRow({
  card,
  selected = false,
  onSelect,
  onPreview,
  onInc,
  onDelete,
  onSetCategory,
  onSetCommander,
  onChangePrinting,
  onShowDetails,
  isMtg,
  isCommander,
  readOnly = false,
  legality,
  rowProps,
  density = 'comfortable',
}: DeckCardRowProps) {
  const { t } = useTranslation();
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const menuTriggerRef = useRef<HTMLElement | null>(null);
  const [quantityAtOpen, setQuantityAtOpen] = useState(card.quantity);
  const illegal = legality?.status === 'illegal' ? legality : undefined;
  const illegalText = illegal && t(`DeckLegality.reason.${illegal.reason}`, { max: illegal.max });
  const unknownText = !readOnly && card.lookupSource === 'unknown' ? t('DeckEditor.row.unknown') : '';
  const description = [unknownText, illegalText].filter(Boolean).join(' ');

  const openMenu = (trigger: HTMLElement, anchor: MenuAnchor) => {
    menuTriggerRef.current = trigger;
    setQuantityAtOpen(card.quantity);
    setMenuAnchor(anchor);
  };
  const openBelow = (trigger: HTMLElement) => {
    const rect = trigger.getBoundingClientRect();
    openMenu(trigger, { rect, placement: 'below', align: 'end' });
  };

  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.target as Node)) {
      return;
    }
    event.preventDefault();
    if (event.clientX === 0 && event.clientY === 0) {
      openBelow(event.currentTarget);
    } else {
      openMenu(event.currentTarget, { x: event.clientX, y: event.clientY });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && isContextMenuKey(event)) {
      event.preventDefault();
      openBelow(event.currentTarget);
      return;
    }
    rowProps?.onKeyDown(event);
  };

  return (
    <div
      {...rowProps}
      role="row"
      aria-label={t('DeckEditor.row.label', { count: card.quantity, card: card.name })}
      aria-description={description || undefined}
      aria-selected={selected}
      className={[
        'group flex items-center gap-2 rounded-ui-sm pl-2 pr-1 transition-colors',
        density === 'compact' ? 'h-[22px] text-[12px]' : 'h-7 text-[13px]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        selected ? 'bg-accent/15 text-accent' : illegal ? 'bg-danger/10 hover:bg-danger/15' : 'text-text-primary hover:bg-bg-elevated',
      ].join(' ')}
      onClick={onSelect}
      onPointerEnter={onPreview && (() => onPreview(true))}
      onPointerLeave={onPreview && (() => onPreview(false))}
      onFocus={(event) => {
        if (event.target === event.currentTarget) {
          onSelect();
        }
      }}
      onKeyDown={readOnly ? rowProps?.onKeyDown : onKeyDown}
      onContextMenu={readOnly ? undefined : onContextMenu}
      title={illegalText}
    >
      <span role="gridcell" className={['w-5 shrink-0 text-right tabular-nums', selected ? 'text-accent' : 'text-text-muted'].join(' ')}>
        {card.quantity}
      </span>
      <span role="gridcell" className="flex min-w-0 flex-1 items-center gap-1.5">
        <button
          type="button"
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          className={['min-w-0 flex-1 truncate text-left', illegal ? 'text-danger' : ''].join(' ')}
        >
          {card.name}
        </button>
        {card.isCommander && (
          <Crown size={12} className="shrink-0 text-warning" role="img" aria-label={t('DeckEditor.row.commander')} />
        )}
      </span>
      <span role="gridcell" className="flex shrink-0 items-center gap-1.5">
        {unknownText && (
          <span className="shrink-0 text-warning" title={unknownText} role="img" aria-label={unknownText}>
            <CircleAlert size={12} />
          </span>
        )}
        {illegalText && (
          <span className="shrink-0 text-danger" role="img" aria-label={illegalText}>
            <Ban size={12} />
          </span>
        )}
        <ManaSymbols cost={card.manaCost ?? ''} size={12} className="shrink-0 opacity-90" />
      </span>
      {!readOnly && <span role="gridcell" className="shrink-0">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            if (menuAnchor) {
              setMenuAnchor(null);
            } else {
              openBelow(e.currentTarget);
            }
          }}
          className={[
            'inline-flex items-center justify-center rounded-ui-sm text-text-muted transition-colors',
            density === 'compact' ? 'h-5 w-5' : 'h-6 w-6',
            'hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
          ].join(' ')}
          aria-label={t('DeckEditor.rowActions.trigger', { card: card.name })}
          title={t('DeckEditor.rowActions.trigger', { card: card.name })}
          aria-haspopup="menu"
          aria-expanded={menuAnchor != null}
        >
          <ChevronDown size={14} />
        </button>
        {menuAnchor && (
          <span role="status" className="sr-only">
            {card.quantity !== quantityAtOpen ? t('DeckEditor.rowActions.quantityNow', { count: card.quantity }) : ''}
          </span>
        )}
      </span>}
      {!readOnly && menuAnchor && (
        <DeckRowActionsMenu
          card={card}
          anchor={menuAnchor}
          triggerRef={menuTriggerRef}
          onClose={() => setMenuAnchor(null)}
          onInc={() => onInc(1)}
          onDec={() => onInc(-1)}
          onDelete={onDelete}
          onSetCategory={onSetCategory}
          onSetCommander={onSetCommander}
          onChangePrinting={onChangePrinting}
          onShowDetails={onShowDetails}
          isMtg={isMtg}
          isCommander={isCommander}
        />
      )}
    </div>
  );
}
