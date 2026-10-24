import { useId } from 'react';
import {
  Archive,
  ChevronDown,
  Crown,
  Flag,
  Mountain,
  MoreHorizontal,
  PawPrint,
  Sparkle,
  Sparkles,
  Trophy,
  Wand2,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { DeckCategory } from '@app/types';

import type { DeckRowDensity } from '../../deckEditorLayout';
import type { DeckSection } from '../../deckGrouping';
import type { CardLegality } from '../../deckLegality';
import type { DeckCard } from '../../types';
import { deckRowKey, type DeckCardGrid } from '../../hooks/useDeckCardGrid';
import { DeckCardRow } from './DeckCardRow';

export interface DeckCardGroupProps {
  label: string;
  indices: number[];
  deck: DeckCard[];
  selectedIndex: number;
  onSelect: (card: DeckCard) => void;
  onPreview?: (card: DeckCard | null) => void;
  onInc: (index: number, delta: number) => void;
  onDelete: (index: number) => void;
  onSetCategory: (index: number, category: DeckCategory) => void;
  onSetCommander: (index: number, isCommander: boolean) => void;
  onChangePrinting: (index: number, card: DeckCard) => void;
  onShowDetails?: (card: DeckCard) => void;
  isMtg: boolean;
  isCommander: boolean;
  readOnly?: boolean;
  legality?: readonly CardLegality[];
  grid?: DeckCardGrid;
  density?: DeckRowDensity;
  columnBreak?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const SECTION_ICON: Record<DeckSection, LucideIcon> = {
  Commander: Crown,
  Creature: PawPrint,
  Planeswalker: Sparkles,
  Battle: Flag,
  Instant: Zap,
  Sorcery: Wand2,
  Enchantment: Sparkle,
  Artifact: Trophy,
  Land: Mountain,
  Other: MoreHorizontal,
  Sideboard: Archive,
};

export function DeckCardGroup({
  label,
  indices,
  deck,
  selectedIndex,
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
  grid,
  density,
  columnBreak = false,
  collapsed = false,
  onToggleCollapsed,
}: DeckCardGroupProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const gridId = useId();
  const totalQty = indices.reduce((sum, i) => sum + deck[i].quantity, 0);
  const Icon = SECTION_ICON[label] ?? MoreHorizontal;
  const title = t(`DeckEditor.section.${label.toLowerCase()}`, { count: totalQty });
  return (
    <section
      className={[
        'min-w-0 break-inside-avoid',
        columnBreak ? 'break-before-column' : '',
        density === 'compact' ? 'mb-3' : 'mb-4',
      ].join(' ')}
    >
      <h3
        id={headingId}
        className="flex items-center border-b border-border-subtle pb-1.5 font-display text-[13px] font-semibold text-text-primary"
      >
        {onToggleCollapsed ? (
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={collapsed ? undefined : gridId}
            onClick={onToggleCollapsed}
            className={[
              '-ml-1 flex min-w-0 flex-1 items-center gap-2 rounded-ui-sm px-1 text-left',
              'hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
            ].join(' ')}
          >
            <ChevronDown
              size={13}
              aria-hidden
              className={['shrink-0 text-text-muted transition-transform', collapsed ? '-rotate-90' : ''].join(' ')}
            />
            <GroupTitle Icon={Icon} label={title} total={totalQty} />
          </button>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <GroupTitle Icon={Icon} label={title} total={totalQty} />
          </span>
        )}
      </h3>
      {!collapsed && (
        <div role="grid" id={gridId} aria-labelledby={headingId} aria-readonly={readOnly} className="mt-1 flex flex-col">
          {indices.map((i) => (
            <DeckCardRow
              key={deckRowKey(deck[i])}
              card={deck[i]}
              selected={i === selectedIndex}
              onSelect={() => onSelect(deck[i])}
              onPreview={onPreview && ((active) => onPreview(active ? deck[i] : null))}
              rowProps={grid?.getDeckRowProps(i)}
              onInc={(delta) => (delta < 0 && grid ? grid.decrementRow(i) : onInc(i, delta))}
              onDelete={() => (grid ? grid.removeRow(i) : onDelete(i))}
              onSetCategory={(c) => (grid ? grid.moveRow(i, c) : onSetCategory(i, c))}
              onSetCommander={(v) => onSetCommander(i, v)}
              onChangePrinting={() => onChangePrinting(i, deck[i])}
              onShowDetails={onShowDetails ? () => onShowDetails(deck[i]) : undefined}
              isMtg={isMtg}
              isCommander={isCommander}
              readOnly={readOnly}
              legality={legality?.[i]}
              density={density}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function GroupTitle({ Icon, label, total }: { Icon: LucideIcon; label: string; total: number }) {
  return (
    <>
      <Icon size={14} className="shrink-0 text-text-muted" aria-hidden />
      <span className="truncate">{label}</span>
      <span className="font-sans font-normal tabular-nums text-text-muted">{total}</span>
    </>
  );
}
