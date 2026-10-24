import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState, usePreferences, useSettings } from '@app/hooks';
import type { Preferences } from '@app/types';
import { cx } from '@app/utils';

import CommittedInput from './controls/CommittedInput';
import { SelectBox, Switch, fieldBox, focusRing, textField } from './controls/fields';
import Highlight from './Highlight';
import type { SettingControl, SettingEntry } from './registry';

interface SettingRowProps {
  entry: SettingEntry;
  query?: string;
}

export const settingControlId = (entry: SettingEntry) => `setting-${entry.id}`;

export default function SettingRow({ entry, query }: SettingRowProps) {
  const { t } = useTranslation();
  const settings = useSettings();
  const preferences = usePreferences();
  const ready = settings.status === LoadingState.READY;
  const disabled = !ready || (entry.dependsOn != null && !preferences[entry.dependsOn]);
  const id = settingControlId(entry);
  const descriptionId = entry.descriptionKey ? `${id}-description` : undefined;

  const update = (patch: Partial<Preferences>) => {
    void settings.update(patch);
  };

  const custom = entry.control.kind === 'custom' ? entry.control : null;
  const block = custom?.layout === 'block';
  const labelId = `${id}-label`;
  const label = <Highlight text={t(entry.labelKey)} query={query} />;

  if (entry.visibleWhen && !entry.visibleWhen(preferences)) {
    return null;
  }

  return (
    <div
      className={cx(
        'px-pad py-[calc(var(--pad)*0.75)]',
        block ? 'flex flex-col gap-3' : 'flex flex-wrap items-center gap-x-6 gap-y-2',
      )}
      data-setting={entry.id}
    >
      <div className="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-0.5">
        {custom ? (
          <span id={labelId} className="text-[13px] font-medium text-text-primary">{label}</span>
        ) : (
          <label id={labelId} htmlFor={id} className="text-[13px] font-medium text-text-primary">{label}</label>
        )}
        {entry.descriptionKey && (
          <p id={descriptionId} className="text-[12px] leading-snug text-text-muted">
            <Highlight text={t(entry.descriptionKey)} query={query} />
          </p>
        )}
      </div>
      <div className={block ? 'w-full min-w-0' : 'flex shrink-0 items-center'}>
        {custom ? (
          <custom.component id={id} labelId={labelId} describedBy={descriptionId} disabled={disabled} />
        ) : (
          <BuiltInControl
            id={id}
            control={entry.control as Exclude<SettingControl, { kind: 'custom' }>}
            preferences={preferences}
            disabled={disabled}
            describedBy={descriptionId}
            onChange={update}
          />
        )}
      </div>
    </div>
  );
}

interface BuiltInControlProps {
  id: string;
  control: Exclude<SettingControl, { kind: 'custom' }>;
  preferences: Preferences;
  disabled: boolean;
  describedBy?: string;
  onChange: (patch: Partial<Preferences>) => void;
}

function BuiltInControl({ id, control, preferences, disabled, describedBy, onChange }: BuiltInControlProps) {
  const { t } = useTranslation();

  switch (control.kind) {
    case 'toggle':
      return (
        <Switch
          id={id}
          checked={preferences[control.key]}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(checked) => onChange({ [control.key]: checked })}
        />
      );
    case 'select':
      return (
        <SelectBox
          id={id}
          value={preferences[control.key]}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(e) => onChange({ [control.key]: e.target.value })}
        >
          {control.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.labelKey ? t(option.labelKey) : (option.label ?? option.value)}
            </option>
          ))}
        </SelectBox>
      );
    case 'range':
      return (
        <RangeControl
          id={id}
          control={control}
          preferences={preferences}
          disabled={disabled}
          describedBy={describedBy}
          onChange={onChange}
        />
      );
    case 'text':
      return (
        <CommittedInput
          id={id}
          type="text"
          className={textField}
          value={preferences[control.key]}
          placeholder={control.placeholderKey ? t(control.placeholderKey) : undefined}
          disabled={disabled}
          aria-describedby={describedBy}
          onCommit={(value) => onChange({ [control.key]: value.trim() })}
        />
      );
    case 'number':
      return (
        <NumberControl
          id={id}
          control={control}
          preferences={preferences}
          disabled={disabled}
          describedBy={describedBy}
          onChange={onChange}
        />
      );
    case 'color':
      return (
        <ColorControl
          id={id}
          value={preferences[control.key]}
          disabled={disabled}
          describedBy={describedBy}
          onCommit={(hex) => onChange({ [control.key]: hex })}
        />
      );
  }
}

export
function pushedAlong(
  control: Extract<SettingControl, { kind: 'number' }>,
  value: number,
  preferences: Preferences,
): Partial<Preferences> {
  if (!control.pushes) {
    return {};
  }
  const { key, keep } = control.pushes;
  const other = preferences[key];
  return (keep === 'atLeast' ? other < value : other > value) ? { [key]: value } : {};
}

function clampWhole(raw: string, min: number, max: number): number | undefined {
  const value = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

type RangeControlProps = Omit<BuiltInControlProps, 'control'> & {
  control: Extract<SettingControl, { kind: 'range' }>;
};

function RangeControl({ id, control, preferences, disabled, describedBy, onChange }: RangeControlProps) {
  const [shown, setShown] = useState<string | null>(null);
  const commit = (raw: string) => {
    setShown(null);
    const patch = { [control.key]: Number(raw) };
    onChange(patch);
    control.onCommit?.({ ...preferences, ...patch });
  };

  return (
    <span className="inline-flex items-center gap-3">
      <CommittedInput
        id={id}
        type="range"
        className={cx('h-1.5 w-44 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-45', focusRing)}
        min={control.min}
        max={control.max}
        step={control.step ?? 1}
        value={String(preferences[control.key])}
        disabled={disabled}
        aria-describedby={describedBy}
        onDraft={setShown}
        onCommit={commit}
      />
      <output htmlFor={id} className="w-12 text-right font-mono text-[12px] tabular-nums text-text-secondary">
        {shown ?? preferences[control.key]}
      </output>
    </span>
  );
}

type NumberControlProps = Omit<BuiltInControlProps, 'control'> & {
  control: Extract<SettingControl, { kind: 'number' }>;
};

function NumberControl({ id, control, preferences, disabled, describedBy, onChange }: NumberControlProps) {
  const { t } = useTranslation();
  const { unitKey } = control;
  const unitId = unitKey ? `${id}-unit` : undefined;
  const commit = (raw: string) => {
    const value = clampWhole(raw, control.min, control.max);
    if (value !== undefined) {
      onChange({ [control.key]: value, ...pushedAlong(control, value, preferences) });
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <CommittedInput
        id={id}
        type="number"
        inputMode="numeric"
        className={cx(fieldBox, 'w-20 px-2.5 text-right font-mono tabular-nums')}
        min={control.min}
        max={control.max}
        step={1}
        value={String(preferences[control.key])}
        disabled={disabled}
        aria-describedby={[describedBy, unitId].filter(Boolean).join(' ') || undefined}
        onCommit={commit}
      />
      {unitKey && <span id={unitId} className="text-[12px] text-text-muted">{t(unitKey)}</span>}
    </span>
  );
}

interface ColorControlProps {
  id: string;
  value: string;
  disabled: boolean;
  describedBy?: string;
  onCommit: (hex: string) => void;
}

function ColorControl({ id, value, disabled, describedBy, onCommit }: ColorControlProps) {
  const [shown, setShown] = useState<string | null>(null);
  return (
    <span
      className={cx(
        'inline-flex h-9 items-center gap-2 rounded-ui border border-border-control bg-bg-sunken pl-1.5 pr-2.5',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
        disabled && 'opacity-45',
      )}
    >
      <CommittedInput
        id={id}
        type="color"
        className={cx(
          'h-6 w-6 cursor-pointer appearance-none rounded-ui-sm border-0 bg-transparent p-0 focus:outline-none',
          '[&::-moz-color-swatch]:rounded-ui-sm [&::-moz-color-swatch]:border-0',
          '[&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-ui-sm [&::-webkit-color-swatch]:border-0',
        )}
        value={`#${value}`}
        disabled={disabled}
        aria-describedby={describedBy}
        onDraft={(draft) => setShown(draft)}
        onCommit={(raw) => {
          setShown(null);
          onCommit(raw.replace(/^#/, '').toUpperCase());
        }}
      />
      <span aria-hidden className="font-mono text-[12px] uppercase text-text-secondary">
        {shown ?? `#${value}`}
      </span>
    </span>
  );
}
