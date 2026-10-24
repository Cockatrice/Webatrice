import { useId, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ArrowDownWideNarrow, ChevronDown, SlidersHorizontal, X } from 'lucide-react';

import type { GameFilters, GametypeMap } from '@cockatrice/datatrice';
import {
  Button,
  Divider,
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuRadioItem,
  MenuSeparator,
  TextInput,
  type MenuAnchor,
} from '@app/components';
import { cx } from '@app/utils';

import { AnchoredPopover } from './AnchoredPopover';
import MoreFilters, { maxAgeLabel } from './MoreFilters';
import {
  PLAYER_PRESETS,
  SORT_OPTIONS,
  chipReset,
  clampPlayers,
  formatSummary,
  hidesFullAndStarted,
  moreFilterChips,
  moreFiltersReset,
  playersSummary,
  setHideFullAndStarted,
  toggleGameType,
  type FilterChip,
  type SortOptionId,
} from './quickFilters';
import type { RoomGameFilters } from './useRoomGameFilters';

export interface QuickFilterBarProps {
  roomFilters: RoomGameFilters;
  gametypeMap: GametypeMap;
  passwordInBar: boolean;
  sort: SortOptionId | null;
  onSort: (sort: SortOptionId) => void;
}

export const SORT_KEYS = {
  newest: 'QuickFilterBar.sort.newest',
  oldest: 'QuickFilterBar.sort.oldest',
  description: 'QuickFilterBar.sort.description',
  host: 'QuickFilterBar.sort.host',
  custom: 'QuickFilterBar.sort.custom',
} as const;

const CHIP_KEYS = {
  hidePassword: 'QuickFilterBar.chip.hidePassword',
  hideBuddiesOnly: 'QuickFilterBar.chip.hideBuddiesOnly',
  hideIgnored: 'QuickFilterBar.chip.hideIgnored',
  hideNotBuddy: 'QuickFilterBar.chip.hideNotBuddy',
  hideOpenDecklist: 'QuickFilterBar.chip.hideOpenDecklist',
  spectators: 'QuickFilterBar.chip.spectators',
} as const;

const PRESET_KEYS = {
  any: 'QuickFilterBar.players.preset.any',
  two: 'QuickFilterBar.players.preset.two',
  threeFour: 'QuickFilterBar.players.preset.threeFour',
  fivePlus: 'QuickFilterBar.players.preset.fivePlus',
} as const;

const PLAYERS_COUNT_KEYS = {
  exactly: 'QuickFilterBar.players.exactly',
  atLeast: 'QuickFilterBar.players.atLeast',
  atMost: 'QuickFilterBar.players.atMost',
} as const;

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

function chipLabel(t: TFunction, chip: FilterChip): string {
  if (chip.id === 'creators') {
    return t('QuickFilterBar.chip.creators', { names: chip.names });
  }
  if (chip.id === 'maxAge') {
    return t('QuickFilterBar.chip.maxAge', { age: maxAgeLabel(t, chip.seconds ?? 0) });
  }
  return t(CHIP_KEYS[chip.id]);
}

function QuickSelect({
  label,
  value,
  active,
  expanded,
  onClick,
  buttonRef,
}: {
  label: string;
  value: string;
  active: boolean;
  expanded: boolean;
  onClick: (button: HTMLButtonElement) => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-haspopup="true"
      aria-expanded={expanded}
      onClick={(event) => onClick(event.currentTarget)}
      className={cx(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-ui border px-2.5 text-[13px]',
        FOCUS,
        active
          ? 'border-accent/60 bg-accent/10 text-accent'
          : 'border-border-control bg-bg-sunken text-text-primary hover:border-accent/60',
      )}
    >
      <span className={active ? 'text-accent' : 'text-text-muted'}>{label}</span>
      <span className="max-w-[10rem] truncate font-medium">{value}</span>
      <ChevronDown size={14} aria-hidden className="text-text-muted" />
    </button>
  );
}

function ToggleChip({ on, onChange, children }: { on: boolean; onChange: (on: boolean) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cx(
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-ui border px-2.5 text-[13px] font-medium',
        FOCUS,
        on ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border-control text-text-secondary hover:text-text-primary',
      )}
    >
      <span
        aria-hidden
        className={cx(
          'relative inline-flex h-4 w-7 rounded-full',
          on ? 'bg-accent' : 'bg-bg-elevated ring-1 ring-inset ring-border-control',
        )}
      >
        <span className={cx('absolute top-0.5 h-3 w-3 rounded-full', on ? 'left-[14px] bg-on-accent' : 'left-0.5 bg-text-muted')} />
      </span>
      {children}
    </button>
  );
}

function PlayersPanel({ filters, onChange }: { filters: GameFilters; onChange: (patch: Partial<GameFilters>) => void }) {
  const { t } = useTranslation();
  const [min, setMin] = useState(String(filters.maxPlayersFilterMin));
  const [max, setMax] = useState(String(filters.maxPlayersFilterMax));
  const minId = useId();
  const maxId = useId();
  const commit = (key: 'maxPlayersFilterMin' | 'maxPlayersFilterMax', text: string) => {
    const value = clampPlayers(Number(text));
    if (text.trim() !== '' && value !== null) {
      onChange({ [key]: value });
    }
  };
  const inputClass = [
    'h-9 w-full rounded-ui border border-border-control bg-bg-sunken px-2.5 text-[13px] tabular-nums text-text-primary',
    'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
  ].join(' ');

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t('QuickFilterBar.players.presets')} className="flex flex-wrap gap-1.5">
        {PLAYER_PRESETS.map((preset) => {
          const on = filters.maxPlayersFilterMin === preset.min && filters.maxPlayersFilterMax === preset.max;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setMin(String(preset.min));
                setMax(String(preset.max));
                onChange({ maxPlayersFilterMin: preset.min, maxPlayersFilterMax: preset.max });
              }}
              className={cx(
                'h-7 rounded-full border px-2.5 text-[12px] font-medium',
                FOCUS,
                on ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border-control text-text-secondary hover:text-text-primary',
              )}
            >
              {t(PRESET_KEYS[preset.id])}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor={minId} className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text-secondary">{t('QuickFilterBar.players.min')}</span>
          <input
            id={minId}
            type="number"
            min={1}
            max={99}
            value={min}
            data-autofocus
            onChange={(event) => {
              setMin(event.target.value);
              commit('maxPlayersFilterMin', event.target.value);
            }}
            className={inputClass}
          />
        </label>
        <label htmlFor={maxId} className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-text-secondary">{t('QuickFilterBar.players.max')}</span>
          <input
            id={maxId}
            type="number"
            min={1}
            max={99}
            value={max}
            onChange={(event) => {
              setMax(event.target.value);
              commit('maxPlayersFilterMax', event.target.value);
            }}
            className={inputClass}
          />
        </label>
      </div>
      <p className="text-[12px] text-text-muted">{t('QuickFilterBar.players.hint')}</p>
    </div>
  );
}

type OpenPanel = 'players' | 'more' | null;

export default function QuickFilterBar({ roomFilters, gametypeMap, passwordInBar, sort, onSort }: QuickFilterBarProps) {
  const { t } = useTranslation();
  const { filters, update, clear, isActive, counts } = roomFilters;
  const [panel, setPanel] = useState<OpenPanel>(null);
  const [formatAnchor, setFormatAnchor] = useState<MenuAnchor | null>(null);
  const [sortAnchor, setSortAnchor] = useState<MenuAnchor | null>(null);
  const formatButton = useRef<HTMLButtonElement>(null);
  const playersButton = useRef<HTMLButtonElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const sortButton = useRef<HTMLButtonElement>(null);

  const gameTypes = useMemo(
    () => Object.entries(gametypeMap).map(([id, name]) => ({ id: Number(id), name })),
    [gametypeMap],
  );
  const chips = moreFilterChips(filters, { passwordInBar });
  const format = formatSummary(filters, gametypeMap);
  const players = playersSummary(filters);
  const formatValue = format.kind === 'all'
    ? t('QuickFilterBar.format.all')
    : format.kind === 'one' ? format.name : t('QuickFilterBar.format.many', { count: format.count });
  const playersValue = players.kind === 'between'
    ? t('QuickFilterBar.players.between', { min: players.min, max: players.max })
    : players.kind === 'any' ? t('QuickFilterBar.players.any') : t(PLAYERS_COUNT_KEYS[players.kind], { count: players.count });
  const below = (button: HTMLElement, align: 'start' | 'end' = 'start'): MenuAnchor => ({
    rect: button.getBoundingClientRect(),
    placement: 'below',
    align,
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          type="search"
          wrapperClassName="w-[16em] shrink-0"
          placeholder={t('QuickFilterBar.search')}
          aria-label={t('QuickFilterBar.search')}
          value={filters.gameNameFilter}
          onChange={(event) => update({ gameNameFilter: event.target.value })}
        />
        {gameTypes.length > 0 && (
          <QuickSelect
            buttonRef={formatButton}
            label={t('QuickFilterBar.format.label')}
            value={formatValue}
            active={format.kind !== 'all'}
            expanded={formatAnchor !== null}
            onClick={(button) => setFormatAnchor(formatAnchor ? null : below(button))}
          />
        )}
        <QuickSelect
          buttonRef={playersButton}
          label={t('QuickFilterBar.players.label')}
          value={playersValue}
          active={players.kind !== 'any'}
          expanded={panel === 'players'}
          onClick={() => setPanel(panel === 'players' ? null : 'players')}
        />
        <ToggleChip on={hidesFullAndStarted(filters)} onChange={(on) => update(setHideFullAndStarted(on))}>
          {t('QuickFilterBar.hideFullAndStarted')}
        </ToggleChip>
        {passwordInBar && (
          <ToggleChip on={filters.hidePasswordProtectedGames} onChange={(on) => update({ hidePasswordProtectedGames: on })}>
            {t('QuickFilterBar.hidePassword')}
          </ToggleChip>
        )}
        <Button
          ref={moreButton}
          icon={<SlidersHorizontal size={14} aria-hidden />}
          aria-haspopup="dialog"
          aria-expanded={panel === 'more'}
          onClick={() => setPanel(panel === 'more' ? null : 'more')}
        >
          {t('QuickFilterBar.more')}
          {chips.length > 0 && (
            <span
              className={[
                'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1',
                'text-[10.5px] font-bold text-on-accent',
              ].join(' ')}
            >
              <span className="sr-only">{t('QuickFilterBar.moreActive', { count: chips.length })}</span>
              <span aria-hidden>{chips.length}</span>
            </span>
          )}
        </Button>
      </div>

      <div className="flex min-h-7 items-center gap-3">
        <span className="shrink-0 text-[12px] tabular-nums text-text-muted" role="status">
          <Trans
            i18nKey="QuickFilterBar.count"
            values={{ visible: counts.visible, total: counts.total }}
            components={{ b: <span className="font-semibold text-text-secondary" /> }}
          />
        </span>
        {(chips.length > 0 || isActive) && <Divider vertical className="h-4" />}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {chips.map((chip) => {
            const label = chipLabel(t, chip);
            return (
              <span
                key={chip.id}
                className={[
                  'inline-flex h-7 min-w-0 shrink items-center gap-1 whitespace-nowrap rounded-full',
                  'border border-accent/50 bg-accent/10 pl-2.5 pr-1 text-[12px] font-medium text-accent',
                ].join(' ')}
              >
                <span className="truncate">{label}</span>
                <button
                  type="button"
                  aria-label={t('QuickFilterBar.removeChip', { filter: label })}
                  onClick={() => update(chipReset(chip.id))}
                  className={cx('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-accent/20', FOCUS)}
                >
                  <X size={12} aria-hidden />
                </button>
              </span>
            );
          })}
          {isActive && (
            <button
              type="button"
              onClick={clear}
              className={cx('shrink-0 rounded-ui-sm px-1 text-[12px] font-medium text-accent hover:underline', FOCUS)}
            >
              {t('QuickFilterBar.clearAll')}
            </button>
          )}
        </div>
        <button
          ref={sortButton}
          type="button"
          aria-haspopup="menu"
          aria-expanded={sortAnchor !== null}
          aria-label={t('QuickFilterBar.sort.label', { sort: t(SORT_KEYS[sort ?? 'custom']) })}
          onClick={(event) => setSortAnchor(sortAnchor ? null : below(event.currentTarget, 'end'))}
          className={cx(
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-ui px-2 text-[12.5px] font-medium text-text-secondary',
            'hover:bg-bg-elevated hover:text-text-primary',
            FOCUS,
          )}
        >
          <ArrowDownWideNarrow size={14} aria-hidden />
          {t(SORT_KEYS[sort ?? 'custom'])}
          <ChevronDown size={13} aria-hidden className="text-text-muted" />
        </button>
      </div>

      {formatAnchor && (
        <Menu
          anchor={formatAnchor}
          label={t('QuickFilterBar.format.label')}
          triggerRef={formatButton}
          onClose={() => setFormatAnchor(null)}
        >
          <MenuItem onSelect={() => update({ gameTypeFilter: [] })}>{t('QuickFilterBar.format.all')}</MenuItem>
          <MenuSeparator />
          {gameTypes.map(({ id, name }) => (
            <MenuCheckboxItem key={id} checked={filters.gameTypeFilter.includes(id)} onChange={() => update(toggleGameType(filters, id))}>
              {name}
            </MenuCheckboxItem>
          ))}
        </Menu>
      )}
      {sortAnchor && (
        <Menu anchor={sortAnchor} label={t('QuickFilterBar.sort.menu')} triggerRef={sortButton} onClose={() => setSortAnchor(null)}>
          {SORT_OPTIONS.map((option) => (
            <MenuRadioItem key={option.id} checked={sort === option.id} closeOnSelect onSelect={() => onSort(option.id)}>
              {t(SORT_KEYS[option.id])}
            </MenuRadioItem>
          ))}
        </Menu>
      )}
      {panel === 'players' && (
        <AnchoredPopover
          anchor={playersButton}
          label={t('QuickFilterBar.players.label')}
          onClose={() => setPanel(null)}
          className="w-[320px]"
        >
          <PlayersPanel filters={filters} onChange={update} />
        </AnchoredPopover>
      )}
      {panel === 'more' && (
        <AnchoredPopover
          anchor={moreButton}
          label={t('QuickFilterBar.more')}
          onClose={() => setPanel(null)}
          align="end"
          className="w-[360px] p-4"
        >
          <MoreFilters
            filters={filters}
            passwordInBar={passwordInBar}
            onChange={update}
            onReset={() => update(moreFiltersReset({ passwordInBar }))}
            onDone={() => setPanel(null)}
          />
        </AnchoredPopover>
      )}
    </div>
  );
}
