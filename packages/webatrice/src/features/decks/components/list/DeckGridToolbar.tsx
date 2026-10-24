import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownUp,
  ChevronDown,
  Download,
  FolderPlus,
  Globe,
  LayoutGrid,
  MoreHorizontal,
  RefreshCw,
  Rows3,
  Share2,
  Tag,
  Trash2,
  X,
} from 'lucide-react';

import { Button, IconButton, Menu, MenuItem, MenuSeparator, Segmented, TextInput, type MenuRect } from '@app/components';
import { cx } from '@app/utils';

import {
  COLOUR_MODES,
  DECK_GRID_SORTS,
  IDENTITY_COLOURS,
  type ColourMode,
  type DeckGridSort,
  type IdentityColour,
} from '../../deckGrid';
import type { DeckFolderEntry } from '../../deckFolders';
import { formatDisplayLabel } from '../../deckSummary';
import type { DeckListViewMode } from '../../hooks/useDeckListViewMode';
import type { UseDeckGrid } from '../../hooks/useDeckGrid';
import { toggleListValue } from '../../deckGrid';

const COLOUR_KEYS = {
  W: 'DeckGridToolbar.colour.W',
  U: 'DeckGridToolbar.colour.U',
  B: 'DeckGridToolbar.colour.B',
  R: 'DeckGridToolbar.colour.R',
  G: 'DeckGridToolbar.colour.G',
} as const satisfies Record<IdentityColour, string>;

const COLOUR_MODE_KEYS = {
  including: 'DeckGridToolbar.colourModes.including',
  exactly: 'DeckGridToolbar.colourModes.exactly',
  atMost: 'DeckGridToolbar.colourModes.atMost',
} as const satisfies Record<ColourMode, string>;

const SORT_KEYS = {
  newest: 'DeckGridToolbar.sorts.newest',
  oldest: 'DeckGridToolbar.sorts.oldest',
  nameAsc: 'DeckGridToolbar.sorts.nameAsc',
  nameDesc: 'DeckGridToolbar.sorts.nameDesc',
} as const satisfies Record<DeckGridSort, string>;

const PIP_BG: Record<IdentityColour, string> = {
  W: 'bg-mana-w', U: 'bg-mana-u', B: 'bg-mana-b', R: 'bg-mana-r', G: 'bg-mana-g',
};

function FilterSelect<T extends string>({ label, value, onChange, options, icon, className }: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('relative inline-flex h-9 shrink-0 items-center', className)}>
      <span className="sr-only">{label}</span>
      {icon && <span className="pointer-events-none absolute left-2.5 text-text-muted" aria-hidden>{icon}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cx(
          'h-full w-full appearance-none rounded-ui border border-border-control bg-bg-sunken pr-8 text-[13px] text-text-primary',
          'focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25',
          icon ? 'pl-8' : 'pl-2.5',
        )}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-text-muted" aria-hidden />
    </label>
  );
}

function ColourFilter({ colours, mode, onColours, onMode }: {
  colours: readonly IdentityColour[];
  mode: ColourMode;
  onColours: (colours: IdentityColour[]) => void;
  onMode: (mode: ColourMode) => void;
}) {
  const { t } = useTranslation();
  return (
    <span
      role="group"
      aria-label={t('DeckGridToolbar.colours')}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-ui border border-border-control bg-bg-sunken pl-2.5 pr-1"
    >
      <span className="text-[12px] text-text-muted" aria-hidden>{t('DeckGridToolbar.colours')}</span>
      {IDENTITY_COLOURS.map((c) => {
        const on = colours.includes(c);
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            aria-label={t(COLOUR_KEYS[c])}
            title={t(COLOUR_KEYS[c])}
            onClick={() => onColours(toggleListValue(colours, c))}
            className={cx(
              'h-[18px] w-[18px] rounded-full ring-1 ring-inset ring-black/25 transition-opacity',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              PIP_BG[c],
              on ? 'opacity-100 outline outline-2 outline-offset-1 outline-text-primary' : 'opacity-50 hover:opacity-100',
            )}
          />
        );
      })}
      <label className="relative ml-1 inline-flex h-7 items-center">
        <span className="sr-only">{t('DeckGridToolbar.colourMode')}</span>
        <select
          value={mode}
          onChange={(e) => onMode(e.target.value as ColourMode)}
          className={cx(
            'h-full appearance-none rounded-ui-sm bg-bg-elevated pl-2 pr-6 text-[12px] text-text-primary',
            'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
          )}
        >
          {COLOUR_MODES.map((m) => <option key={m} value={m}>{t(COLOUR_MODE_KEYS[m])}</option>)}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute right-1.5 text-text-muted" aria-hidden />
      </label>
    </span>
  );
}

function ViewModeLabel({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span title={label} className="flex items-center">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export interface DeckFolderActions {
  onNewFolder: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onShare?: () => void;
  onTogglePublic?: () => void;
}

function FolderActionsMenu({ folder, actions }: { folder: DeckFolderEntry; actions: DeckFolderActions }) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<MenuRect | null>(null);
  return (
    <>
      <IconButton
        ref={triggerRef}
        label={t('DeckGridToolbar.folderActions', { name: folder.name })}
        aria-haspopup="menu"
        aria-expanded={rect != null}
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setRect(rect ? null : { left: box.left, top: box.top, right: box.right, bottom: box.bottom });
        }}
      >
        <MoreHorizontal size={16} />
      </IconButton>
      {rect && (
        <Menu
          anchor={{ rect, placement: 'below', align: 'start' }}
          label={t('DeckGridToolbar.folderActions', { name: folder.name })}
          triggerRef={triggerRef}
          onClose={() => setRect(null)}
          className="w-72"
        >
          <MenuItem icon={<FolderPlus size={14} />} onSelect={actions.onNewFolder}>{t('DeckGridToolbar.newSubfolder')}</MenuItem>
          {actions.onShare && (
            <MenuItem icon={<Share2 size={14} />} onSelect={actions.onShare}>{t('DeckGridToolbar.shareFolder')}</MenuItem>
          )}
          {actions.onTogglePublic && (
            <MenuItem icon={<Globe size={14} />} onSelect={actions.onTogglePublic}>
              {t(folder.visibility === 'public' ? 'DeckGridToolbar.makeFolderPrivate' : 'DeckGridToolbar.makeFolderPublic')}
            </MenuItem>
          )}
          <MenuItem icon={<Download size={14} />} onSelect={actions.onDownload}>{t('DeckFolders.downloadFolder')}</MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Trash2 size={14} className="text-danger" />} onSelect={actions.onDelete}>
            <span className="text-danger">{t('DeckFolders.deleteFolder')}</span>
          </MenuItem>
        </Menu>
      )}
    </>
  );
}

export interface DeckGridToolbarProps {
  title: string;
  deckCount: number;
  folderCount: number;
  folder: DeckFolderEntry | null;
  folderActions?: DeckFolderActions;
  grid: UseDeckGrid;
  isConnected: boolean;
  viewMode: DeckListViewMode;
  onViewModeChange: (mode: DeckListViewMode) => void;
  onRefresh: () => void;
}

export function DeckGridToolbar({
  title, deckCount, folderCount, folder, folderActions, grid, isConnected, viewMode, onViewModeChange, onRefresh,
}: DeckGridToolbarProps) {
  const { t } = useTranslation();
  const { filters, setFilters, options } = grid;
  const ANY = '';
  return (
    <div className="flex shrink-0 flex-col gap-3 border-b border-border-subtle px-6 pb-3 pt-4">
      <div className="flex min-w-0 items-center gap-3">
        <h2 className="truncate font-display text-[20px] font-semibold text-text-primary">{title}</h2>
        <span className="shrink-0 text-[13px] text-text-muted">
          {t('DeckGridToolbar.summary', { decks: deckCount, folders: folderCount })}
        </span>
        {folder && folderActions && <FolderActionsMenu folder={folder} actions={folderActions} />}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <FilterSelect<DeckGridSort>
            label={t('DeckGridToolbar.sort')}
            value={grid.sort}
            onChange={grid.setSort}
            icon={<ArrowDownUp size={14} />}
            className="w-40"
            options={DECK_GRID_SORTS.map((s) => ({ value: s, label: t(SORT_KEYS[s]) }))}
          />
          <Segmented<DeckListViewMode>
            label={t('Decks.list.viewMode')}
            value={viewMode}
            onChange={onViewModeChange}
            items={[
              { value: 'card', label: <ViewModeLabel icon={<LayoutGrid size={14} aria-hidden />} label={t('Decks.list.view.card')} /> },
              { value: 'compact', label: <ViewModeLabel icon={<Rows3 size={14} aria-hidden />} label={t('Decks.list.view.compact')} /> },
            ]}
          />
          <IconButton label={t('Decks.list.refreshLabel')} onClick={onRefresh} disabled={!isConnected}>
            <RefreshCw size={15} />
          </IconButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          aria-label={t('DeckGridToolbar.search')}
          placeholder={t('DeckGridToolbar.searchPlaceholder')}
          value={filters.query}
          onChange={(e) => setFilters({ query: e.target.value })}
          wrapperClassName="w-64"
          type="search"
        />
        <ColourFilter
          colours={filters.colours}
          mode={filters.colourMode}
          onColours={(colours) => setFilters({ colours })}
          onMode={(colourMode) => setFilters({ colourMode })}
        />
        <FilterSelect
          label={t('DeckGridToolbar.format')}
          value={filters.format ?? ANY}
          onChange={(v) => setFilters({ format: v || null })}
          className="w-40"
          options={[
            { value: ANY, label: t('DeckGridToolbar.anyFormat') },
            ...options.formats.map((f) => ({ value: f, label: formatDisplayLabel(f, t) })),
          ]}
        />
        <FilterSelect
          label={t('DeckGridToolbar.bracket')}
          value={filters.bracket != null ? String(filters.bracket) : ANY}
          onChange={(v) => setFilters({ bracket: v ? Number(v) : null })}
          className="w-40"
          options={[
            { value: ANY, label: t('DeckGridToolbar.anyBracket') },
            ...options.brackets.map((b) => ({ value: String(b), label: t('DeckGridToolbar.bracketOption', { level: b }) })),
          ]}
        />
        {grid.filtered && (
          <Button variant="quiet" size="sm" icon={<X size={13} />} onClick={grid.clearFilters}>
            {t('DeckGridToolbar.clear')}
          </Button>
        )}
        {grid.pending > 0 && (
          <span role="status" className="text-[12px] text-text-muted">
            {t('DeckGridToolbar.pending', { count: grid.pending })}
          </span>
        )}
      </div>
      {options.tags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto" role="group" aria-label={t('DeckGridToolbar.tags')}>
          <Tag size={13} className="mr-1 shrink-0 text-text-muted" aria-hidden />
          {options.tags.map((tag) => {
            const on = filters.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => setFilters({ tags: toggleListValue(filters.tags, tag) })}
                className={cx(
                  'inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-[12px]',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                  on ? 'border-accent/60 bg-accent/15 text-accent' : 'border-border-subtle text-text-secondary hover:bg-bg-elevated',
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
