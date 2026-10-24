import { useMemo, useState, type RefObject } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { sortIndicesByName } from '../../deckGrouping';
import { deckRowKey, type DeckCardGrid, type DeckCardRowProps } from '../../hooks/useDeckCardGrid';
import type { DeckCard } from '../../types';

/** Bare "type a card name and press Enter to add" input shown in the
 *  non-MTG toolbar. No autocomplete, no lookup — the whole point of a
 *  non-MTG deck is that we don't know what the cards are. */
export function PlainAddCard({ onAdd, inputRef }: { onAdd: (name: string) => void; inputRef?: RefObject<HTMLInputElement | null> }) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const handleAdd = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    onAdd(trimmed);
    setValue('');
  };
  return (
    <div className="relative w-72">
      <Plus
        size={12}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
          }
        }}
        placeholder={t('DeckEditor.list.addPlaceholder')}
        aria-label={t('DeckEditor.list.addPlaceholder')}
        className={[
          'w-full pl-7 pr-3 py-1.5 rounded-md bg-bg-base border',
          'border-border-subtle text-xs text-text-primary',
          'placeholder:text-text-muted focus:outline-none',
          'focus:ring-1 focus:border-accent focus:ring-accent transition-colors',
        ].join(' ')}
      />
    </div>
  );
}

/** Flat single-column card list for non-MTG decks. Same row shape as
 *  MTG cards but stripped of previews, printings, commander toggle,
 *  and price. Uses the same alphabetical sort so the list reads the
 *  way the deck editor already does for MTG decks. */
export function PlainCardList({
  cards,
  onInc,
  onDelete,
  grid,
  order,
}: {
  cards: DeckCard[];
  onInc: (index: number, delta: number) => void;
  onDelete: (index: number) => void;
  grid?: DeckCardGrid;
  order?: readonly number[];
}) {
  const { t } = useTranslation();
  const sortedIndices = useMemo(() => order ?? sortIndicesByName(cards, cards.map((_, i) => i)), [cards, order]);

  return (
    <div role="grid" aria-label={t('DeckEditor.list.label')}>
      {sortedIndices.map((i) => (
        <PlainCardRow
          key={deckRowKey(cards[i])}
          card={cards[i]}
          rowProps={grid?.getDeckRowProps(i)}
          onInc={(delta) => (delta < 0 && grid ? grid.decrementRow(i) : onInc(i, delta))}
          onDelete={() => (grid ? grid.removeRow(i) : onDelete(i))}
        />
      ))}
    </div>
  );
}

function PlainCardRow({
  card,
  rowProps,
  onInc,
  onDelete,
}: {
  card: DeckCard;
  rowProps?: DeckCardRowProps;
  onInc: (delta: number) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const buttonTabIndex = rowProps ? -1 : undefined;
  return (
    <div
      {...rowProps}
      role="row"
      aria-label={t('DeckEditor.row.label', { count: card.quantity, card: card.name })}
      className={[
        'group flex items-center gap-2 px-2 py-1 rounded hover:bg-bg-elevated transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      ].join(' ')}
    >
      <span role="gridcell" className="text-xs tabular-nums text-text-muted w-6 text-right shrink-0">
        {card.quantity}
      </span>
      <span role="gridcell" className="flex-1 min-w-0 truncate text-sm text-text-primary">
        {card.name}
      </span>
      <div
        role="gridcell"
        className={[
          'shrink-0 flex items-center gap-0.5 opacity-0 transition-opacity',
          'group-hover:opacity-100 group-focus-within:opacity-100',
        ].join(' ')}
      >
        <button
          type="button"
          tabIndex={buttonTabIndex}
          onClick={() => onInc(-1)}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors"
          title={t('DeckEditor.list.decrease')}
          aria-label={t('DeckEditor.list.decreaseCard', { card: card.name })}
        >
          <Minus size={12} />
        </button>
        <button
          type="button"
          tabIndex={buttonTabIndex}
          onClick={() => onInc(1)}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors"
          title={t('DeckEditor.list.increase')}
          aria-label={t('DeckEditor.list.increaseCard', { card: card.name })}
        >
          <Plus size={12} />
        </button>
        <button
          type="button"
          tabIndex={buttonTabIndex}
          onClick={onDelete}
          className="p-1 rounded text-text-muted hover:text-danger hover:bg-red-500/10 transition-colors"
          title={t('Common.action.remove')}
          aria-label={t('DeckEditor.list.removeCard', { card: card.name })}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
