import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import type { GroupMode, SortMode } from './zoneViewSort';

const TOOLBAR_SELECT_CLASS =
  'px-3 py-2 rounded-md bg-bg-base border border-border-subtle text-sm text-text-primary '
  + 'focus:outline-none focus:border-accent';

export interface ZoneViewSortControlsProps {
  groupBy: GroupMode;
  sortBy: SortMode;
  onGroupByChange: (groupBy: GroupMode) => void;
  onSortByChange: (sortBy: SortMode) => void;
}

export function ZoneViewSortControls({ groupBy, sortBy, onGroupByChange, onSortByChange }: ZoneViewSortControlsProps): ReactElement {
  const { t } = useTranslation();
  return (
    <>
      <select
        value={groupBy}
        onChange={(e) => onGroupByChange(e.target.value as GroupMode)}
        className={TOOLBAR_SELECT_CLASS}
        title={t('ZoneView.groupBy.label')}
      >
        <option value="none">{t('ZoneView.groupBy.none')}</option>
        <option value="type">{t('ZoneView.groupBy.type')}</option>
        <option value="cmc">{t('ZoneView.groupBy.cmc')}</option>
        <option value="color">{t('ZoneView.groupBy.color')}</option>
      </select>
      <select
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value as SortMode)}
        className={TOOLBAR_SELECT_CLASS}
        title={t('ZoneView.sortBy.label')}
      >
        <option value="none">{t('ZoneView.sortBy.none')}</option>
        <option value="name">{t('ZoneView.sortBy.name')}</option>
        <option value="cmc">{t('ZoneView.sortBy.cmc')}</option>
        <option value="type">{t('ZoneView.sortBy.type')}</option>
        <option value="color">{t('ZoneView.sortBy.color')}</option>
        <option value="set">{t('ZoneView.sortBy.set')}</option>
        <option value="pt">{t('ZoneView.sortBy.pt')}</option>
      </select>
    </>
  );
}

export interface PileViewToggleProps {
  groupBy: GroupMode;
  pileView: boolean;
  onChange: (pileView: boolean) => void;
}

export function PileViewToggle({ groupBy, pileView, onChange }: PileViewToggleProps): ReactElement {
  const { t } = useTranslation();
  const ungrouped = groupBy === 'none';
  return (
    <label
      className={[
        'flex items-center gap-1.5 text-xs select-none',
        ungrouped ? 'text-text-disabled cursor-not-allowed' : 'text-text-muted cursor-pointer',
      ].join(' ')}
      title={ungrouped ? t('ZoneView.pileViewRequiresGrouping') : t('ZoneView.pileViewDescription')}
    >
      <input
        type="checkbox"
        checked={pileView && !ungrouped}
        disabled={ungrouped}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent"
      />
      {t('ZoneView.pileView')}
    </label>
  );
}
