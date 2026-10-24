import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ChevronDown } from 'lucide-react';

import type { GameFilters } from '@cockatrice/datatrice';
import { Button, Checkbox, SectionLabel, TextInput } from '@app/components';

import { MAX_AGE_OPTIONS, parseCreatorNames } from './quickFilters';

export interface MoreFiltersProps {
  filters: GameFilters;
  passwordInBar: boolean;
  onChange: (patch: Partial<GameFilters>) => void;
  onReset: () => void;
  onDone: () => void;
}

export function maxAgeLabel(t: TFunction, seconds: number): string {
  if (seconds === 0) {
    return t('MoreFilters.maxAge.any');
  }
  return seconds < 60 * 60
    ? t('MoreFilters.maxAge.minutes', { count: seconds / 60 })
    : t('MoreFilters.maxAge.hours', { count: seconds / (60 * 60) });
}

export default function MoreFilters({ filters, passwordInBar, onChange, onReset, onDone }: MoreFiltersProps) {
  const { t } = useTranslation();
  const [creators, setCreators] = useState(filters.creatorNameFilters.join(', '));
  const ageId = useId();
  const spectatorsOn = filters.showOnlyIfSpectatorsCanWatch;

  return (
    <div className="flex flex-col gap-3">
      <TextInput
        label={t('MoreFilters.creators.label')}
        placeholder={t('MoreFilters.creators.placeholder')}
        icon={null}
        value={creators}
        data-autofocus
        onChange={(event) => {
          setCreators(event.target.value);
          onChange({ creatorNameFilters: parseCreatorNames(event.target.value) });
        }}
      />
      <label htmlFor={ageId} className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-text-secondary">{t('MoreFilters.maxAge.label')}</span>
        <span className="relative">
          <select
            id={ageId}
            value={filters.maxGameAgeSeconds}
            onChange={(event) => onChange({ maxGameAgeSeconds: Number(event.target.value) })}
            className={[
              'h-9 w-full appearance-none rounded-ui border border-border-control bg-bg-sunken pl-2.5 pr-8 text-[13px]',
              'text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
            ].join(' ')}
          >
            {MAX_AGE_OPTIONS.map((seconds) => (
              <option key={seconds} value={seconds} className="bg-bg-surface text-text-primary">
                {maxAgeLabel(t, seconds)}
              </option>
            ))}
          </select>
          <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        </span>
      </label>

      <SectionLabel>{t('MoreFilters.section.hide')}</SectionLabel>
      <div className="flex flex-col gap-2">
        {!passwordInBar && (
          <Checkbox
            checked={filters.hidePasswordProtectedGames}
            onChange={(on) => onChange({ hidePasswordProtectedGames: on })}
            label={t('MoreFilters.hide.password')}
          />
        )}
        <Checkbox
          checked={filters.hideNotBuddyCreatedGames}
          onChange={(on) => onChange({ hideNotBuddyCreatedGames: on })}
          label={t('MoreFilters.hide.notBuddyCreated')}
        />
        <Checkbox
          checked={filters.hideIgnoredUserGames}
          onChange={(on) => onChange({ hideIgnoredUserGames: on })}
          label={t('MoreFilters.hide.ignoredUsers')}
        />
        <Checkbox
          checked={filters.hideBuddiesOnlyGames}
          onChange={(on) => onChange({ hideBuddiesOnlyGames: on })}
          label={t('MoreFilters.hide.buddiesOnly')}
        />
        <Checkbox
          checked={filters.hideOpenDecklistGames}
          onChange={(on) => onChange({ hideOpenDecklistGames: on })}
          label={t('MoreFilters.hide.openDecklist')}
        />
      </div>

      <SectionLabel>{t('MoreFilters.section.spectators')}</SectionLabel>
      <div className="flex flex-col gap-2">
        <Checkbox
          checked={spectatorsOn}
          onChange={(on) => onChange({ showOnlyIfSpectatorsCanWatch: on })}
          label={t('MoreFilters.spectators.canWatch')}
        />
        <div className="flex flex-col gap-2 pl-6">
          <Checkbox
            checked={filters.showSpectatorPasswordProtected}
            disabled={!spectatorsOn}
            onChange={(on) => onChange({ showSpectatorPasswordProtected: on })}
            label={t('MoreFilters.spectators.needPassword')}
          />
          <Checkbox
            checked={filters.showOnlyIfSpectatorsCanChat}
            disabled={!spectatorsOn}
            onChange={(on) => onChange({ showOnlyIfSpectatorsCanChat: on })}
            label={t('MoreFilters.spectators.canChat')}
          />
          <Checkbox
            checked={filters.showOnlyIfSpectatorsCanSeeHands}
            disabled={!spectatorsOn}
            onChange={(on) => onChange({ showOnlyIfSpectatorsCanSeeHands: on })}
            label={t('MoreFilters.spectators.canSeeHands')}
          />
        </div>
      </div>

      <div className="mt-1 flex justify-end gap-2 border-t border-border-subtle pt-3">
        <Button
          size="sm"
          variant="quiet"
          onClick={() => {
            setCreators('');
            onReset();
          }}
        >
          {t('Common.action.reset')}
        </Button>
        <Button size="sm" variant="primary" onClick={onDone}>
          {t('MoreFilters.done')}
        </Button>
      </div>
    </div>
  );
}
