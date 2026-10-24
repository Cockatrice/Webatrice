import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { DeckCategory } from '@app/types';

import { DECK_COLUMN_GAP, deckColumnLayout } from '../../deckColumns';
import type { DeckRowDensity } from '../../deckEditorLayout';
import { sortIndicesByName, type DeckCardGroup as DeckCardGroupData } from '../../deckGrouping';
import type { CardLegality } from '../../deckLegality';
import { useDeckCardGrid } from '../../hooks/useDeckCardGrid';
import { useElementWidth } from '../../hooks/useElementWidth';
import type { DeckCard, HydratedDeck } from '../../types';
import { DeckCardGroup } from './DeckCardGroup';
import { EmptyCardsHint } from './DeckEditorShells';
import { PlainCardList } from './PlainCardList';

export interface DeckMainPaneProps {
  deck: HydratedDeck;
  groups: DeckCardGroupData[];
  selectedIndex: number;
  onSelect: (card: DeckCard) => void;
  onPreview?: (card: DeckCard | null) => void;
  onInc: (index: number, delta: number) => void;
  onDelete: (index: number) => void;
  onSetCategory: (index: number, category: DeckCategory) => void;
  onSetCommander: (index: number, isCommander: boolean) => void;
  onChangePrinting: (index: number, card: DeckCard) => void;
  onShowDetails?: (card: DeckCard) => void;
  onLastRowRemoved?: () => void;
  isMtg: boolean;
  isCommander: boolean;
  readOnly?: boolean;
  placeholderRows?: readonly number[];
  waitingMessage?: string;
  legality?: readonly CardLegality[];
  density?: DeckRowDensity;
  collapsedGroups?: ReadonlySet<string>;
  onToggleGroup?: (label: string) => void;
}

const NO_GROUPS: ReadonlySet<string> = new Set();

export const DeckMainPane = memo(function DeckMainPane({
  deck,
  groups,
  selectedIndex,
  onSelect,
  onPreview,
  onInc,
  onDelete,
  onSetCategory,
  onSetCommander,
  onChangePrinting,
  onShowDetails,
  onLastRowRemoved,
  isMtg,
  isCommander,
  readOnly = false,
  placeholderRows,
  waitingMessage,
  legality,
  density = 'comfortable',
  collapsedGroups = NO_GROUPS,
  onToggleGroup,
}: DeckMainPaneProps) {
  const { t } = useTranslation();
  const [measureRef, width] = useElementWidth<HTMLDivElement>();
  const rowOrder = useMemo(
    () => (isMtg || readOnly
      ? groups.flatMap(({ label, indices }) => (collapsedGroups.has(label) ? [] : indices))
      : sortIndicesByName(deck.cards, deck.cards.map((_, i) => i))),
    [isMtg, readOnly, groups, deck.cards, collapsedGroups],
  );
  const columns = useMemo(
    () => deckColumnLayout(width, density, groups.map(({ label, indices }) => ({
      rows: indices.length,
      collapsed: collapsedGroups.has(label),
    }))),
    [width, density, groups, collapsedGroups],
  );
  const grid = useDeckCardGrid({
    readOnly,
    cards: deck.cards,
    order: rowOrder,
    onInc,
    onDelete,
    onSetCategory,
    onLastRowRemoved,
  });

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-4">
      <div ref={measureRef} aria-hidden className="h-0" />
      {placeholderRows ? (
        <ul aria-label={t('DeckEditor.shell.loadingDeck')} aria-busy="true" className="max-w-md">
          {placeholderRows.map((row) => (
            <li key={row} className={density === 'compact' ? 'flex h-7 items-center gap-3' : 'flex h-9 items-center gap-3'}>
              <span className="h-4 w-6 animate-pulse rounded bg-bg-elevated" />
              <span className="h-4 w-3/5 animate-pulse rounded bg-bg-elevated" />
            </li>
          ))}
        </ul>
      ) : waitingMessage ? (
        <p role="status" className="text-sm text-text-muted">{waitingMessage}</p>
      ) : deck.cards.length === 0 ? (
        readOnly ? <p role="status" className="text-sm text-text-muted">{t('DeckEditor.shell.loadingDeck')}</p>
          : <EmptyCardsHint isMtg={isMtg} />
      ) : isMtg || readOnly ? (
        <div style={{ columnCount: columns.count, columnGap: DECK_COLUMN_GAP, maxWidth: columns.maxWidth }}>
          {groups.map(({ label, indices }, position) => (
            <DeckCardGroup
              key={label}
              label={label}
              indices={indices}
              deck={deck.cards}
              selectedIndex={selectedIndex}
              onSelect={onSelect}
              onPreview={onPreview}
              onInc={onInc}
              onDelete={onDelete}
              onSetCategory={onSetCategory}
              onSetCommander={onSetCommander}
              onChangePrinting={onChangePrinting}
              onShowDetails={onShowDetails}
              isMtg={isMtg}
              isCommander={isCommander}
              readOnly={readOnly}
              legality={legality}
              grid={grid}
              density={density}
              columnBreak={columns.breaks.has(position)}
              collapsed={collapsedGroups.has(label)}
              onToggleCollapsed={onToggleGroup && (() => onToggleGroup(label))}
            />
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-md">
          <PlainCardList
            cards={deck.cards}
            onInc={onInc}
            onDelete={onDelete}
            grid={grid}
            order={rowOrder}
          />
        </div>
      )}
    </div>
  );
});
