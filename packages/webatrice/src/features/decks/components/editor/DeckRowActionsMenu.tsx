import type { KeyboardEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, Crown, Info, Layers, Minus, PackageOpen, Plus, Trash2 } from 'lucide-react';

import { Menu, MenuItem, MenuSeparator, type MenuAnchor } from '@app/components';
import { matchesEvent, useMenuShortcut, useResolvedBinding } from '@app/feature-widgets/shortcuts';
import type { DeckCategory } from '@app/types';

import type { DeckCard } from '../../types';

export interface DeckRowActionsMenuProps {
  card: DeckCard;
  anchor: MenuAnchor;
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onInc: () => void;
  onDec: () => void;
  onDelete: () => void;
  onSetCategory: (category: DeckCategory) => void;
  onSetCommander: (isCommander: boolean) => void;
  onChangePrinting: () => void;
  onShowDetails?: () => void;
  /** Deck-level format flag. Non-MTG decks drop the printings-picker
   *  menu item since Scryfall has nothing to show. */
  isMtg: boolean;
  /** Deck-level format flag. Non-commander decks drop the
   *  "Mark as commander" toggle. */
  isCommander: boolean;
}

export function DeckRowActionsMenu({
  card,
  anchor,
  triggerRef,
  onClose,
  onInc,
  onDec,
  onDelete,
  onSetCategory,
  onSetCommander,
  onChangePrinting,
  onShowDetails,
  isMtg,
  isCommander,
}: DeckRowActionsMenuProps) {
  const { t } = useTranslation();
  const menuShortcut = useMenuShortcut();
  // Renamed from `isCommander` to avoid shadowing the deck-level
  // `isCommander` prop (deck format = Commander) with a card-level
  // check (this row is flagged as the commander).
  const cardIsCommander = !!card.isCommander;
  const isSideboard = card.category === 'sideboard';
  const addShortcut = menuShortcut('deck.addCard');
  const removeShortcut = menuShortcut('deck.removeCard');
  const addSequences = useResolvedBinding('deck.addCard');
  const removeSequences = useResolvedBinding('deck.removeCard');

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const matches = (sequences: readonly string[]) => sequences.some((sequence) => matchesEvent(sequence, event.nativeEvent));
    if (matches(addSequences)) {
      event.preventDefault();
      onInc();
    } else if (matches(removeSequences)) {
      event.preventDefault();
      onDec();
      if (card.quantity <= 1) {
        onClose();
      }
    }
  };

  return (
    <Menu
      anchor={anchor}
      label={t('DeckEditor.rowActions.trigger', { card: card.name })}
      onClose={onClose}
      triggerRef={triggerRef}
      className="w-[220px]"
      onKeyDown={onKeyDown}
    >
      <div className="px-3 py-1.5 flex items-center justify-between text-xs" aria-hidden>
        <span className="text-text-secondary">{t('DeckEditor.rowActions.quantity')}</span>
        <span className="tabular-nums text-text-primary font-semibold text-sm">{card.quantity}</span>
      </div>
      <MenuItem icon={<Plus size={13} />} onSelect={onInc} closeOnSelect={false} {...addShortcut}>
        {t('DeckEditor.rowActions.addOne')}
      </MenuItem>
      <MenuItem
        icon={<Minus size={13} />}
        onSelect={onDec}
        closeOnSelect={card.quantity <= 1}
        {...removeShortcut}
      >
        {t('DeckEditor.rowActions.removeOne')}
      </MenuItem>
      <MenuSeparator />

      {onShowDetails && (
        <MenuItem icon={<Info size={13} />} onSelect={onShowDetails}>
          {t('DeckEditor.rowActions.details')}
        </MenuItem>
      )}
      {isMtg && (
        <MenuItem icon={<Layers size={13} />} onSelect={onChangePrinting}>
          {t('DeckEditor.rowActions.changePrinting')}
        </MenuItem>
      )}
      {isCommander && (
        <MenuItem
          icon={<Crown size={13} className={cardIsCommander ? 'text-warning' : ''} />}
          onSelect={() => onSetCommander(!cardIsCommander)}
        >
          {t(cardIsCommander ? 'DeckEditor.rowActions.unmarkCommander' : 'DeckEditor.rowActions.markCommander')}
        </MenuItem>
      )}
      {isSideboard ? (
        <MenuItem icon={<PackageOpen size={13} />} onSelect={() => onSetCategory('main')}>
          {t('DeckEditor.rowActions.moveToMain')}
        </MenuItem>
      ) : (
        <MenuItem
          icon={<Archive size={13} />}
          onSelect={() => onSetCategory('sideboard')}
          disabled={cardIsCommander}
          disabledReason={t('DeckEditor.rowActions.commanderStaysMain')}
        >
          {t('DeckEditor.rowActions.moveToSideboard')}
        </MenuItem>
      )}

      <MenuSeparator />
      <MenuItem icon={<Trash2 size={13} className="text-danger" />} onSelect={onDelete}>
        {t('Common.action.remove')}
      </MenuItem>
    </Menu>
  );
}
