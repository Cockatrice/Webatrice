import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MTG_FORMAT_LABELS, MTG_FORMATS, normalizeFormat } from '@app/types';

import { SELECT_CHEVRON_BACKGROUND } from '../selectChevron';

export interface FormatPickerProps {
  value: string;
  onChange: (value: string) => void;
  variant: 'dialog' | 'sidebar';
}

const VARIANTS = {
  dialog: {
    root: 'space-y-2',
    select: [
      'w-full appearance-none bg-bg-base border border-border-subtle',
      'rounded-md pl-3 pr-8 py-2 text-sm text-text-primary',
      'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors',
    ].join(' '),
    chevronPosition: 'right 10px center',
    input: [
      'w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2',
      'text-sm text-text-primary placeholder:text-text-muted',
      'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors',
    ].join(' '),
    autoFocus: true,
  },
  sidebar: {
    root: 'mt-1 space-y-1.5',
    select: [
      'w-full appearance-none bg-bg-base border border-border-subtle rounded-md pl-2 pr-7',
      'py-1 text-xs text-text-primary focus:outline-none focus:border-accent transition-colors',
    ].join(' '),
    chevronPosition: 'right 6px center',
    input: 'w-full bg-bg-base border border-border-subtle rounded-md px-2 py-1 text-xs '
      + 'text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent '
      + 'transition-colors',
    autoFocus: false,
  },
} as const;

export function FormatPicker({ value, onChange, variant }: FormatPickerProps) {
  const { t } = useTranslation();
  const styles = VARIANTS[variant];
  const normalized = normalizeFormat(value);
  const isKnown = MTG_FORMATS.includes(normalized);

  const [otherMode, setOtherMode] = useState(() => !isKnown && normalized !== '');

  const inOtherMode = otherMode || (!isKnown && normalized !== '');
  const unset = !inOtherMode && normalized === '';
  const dropdownValue = inOtherMode ? 'other' : (isKnown || unset ? normalized : 'commander');

  return (
    <div className={styles.root}>
      <select
        aria-label={t('FormatPicker.label')}
        value={dropdownValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === 'other') {
            setOtherMode(true);
            onChange('');
          } else {
            setOtherMode(false);
            onChange(next);
          }
        }}
        className={styles.select}
        style={{
          backgroundImage: SELECT_CHEVRON_BACKGROUND,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: styles.chevronPosition,
        }}
      >
        {unset && <option value="">{t('FormatPicker.unset')}</option>}
        {MTG_FORMAT_LABELS.map((o) => (
          <option key={o.value} value={o.value}>{o.label(t)}</option>
        ))}
        <option value="other">{t(`FormatPicker.other.${variant}`)}</option>
      </select>
      {inOtherMode && (
        <input
          type="text"
          value={isKnown ? '' : value}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next);
            if (MTG_FORMATS.includes(normalizeFormat(next))) {
              setOtherMode(false);
            }
          }}
          placeholder={t(`FormatPicker.placeholder.${variant}`)}
          maxLength={60}
          className={styles.input}
          autoFocus={styles.autoFocus}
        />
      )}
    </div>
  );
}
