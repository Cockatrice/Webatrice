import { useId, useMemo } from 'react';
import { useForm, Controller, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { Button, Checkbox, TextInput } from '@app/components';
import { fieldClass, labelClass, sectionLabelClass } from '@app/feature-wrappers/staff';
import { cx } from '@app/utils';

import {
  applyLogSearchDefaults,
  buildLogSearchSchema,
  LOG_MAX_DAYS,
  LOG_MAX_RESULTS,
  LOG_SEARCH_DEFAULTS,
  type LogSearchFormValues,
} from './logSearchFormSchema';

export type { LogSearchFormValues };

interface LogSearchFormProps {
  onSubmit: (values: LogSearchFormValues) => void;
  developer?: boolean;
}

type TextFilter = 'userName' | 'ipAddress' | 'gameName' | 'gameId' | 'message';
const TEXT_FILTERS: TextFilter[] = ['userName', 'ipAddress', 'gameName', 'gameId', 'message'];
const LOCATIONS = ['room', 'game', 'chat'] as const;
const LOCATION_LABEL_KEYS = {
  room: 'LogSearchForm.label.rooms',
  game: 'LogSearchForm.label.games',
  chat: 'LogSearchForm.label.chats',
} as const;
const MAX_NAME_LENGTH = 0xff;
const MAX_TEXT_LENGTH = 0xfff;

const NumberField = ({ control, name, label, max }: {
  control: Control<LogSearchFormValues>;
  name: 'pastDays' | 'maximumResults';
  label: string;
  max: number;
}) => {
  const id = useId();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <span className="flex h-9 items-center gap-2">
          <label htmlFor={id} className={labelClass}>{label}</label>
          <input
            id={id}
            name={field.name}
            type="number"
            min={0}
            max={max}
            step={1}
            className={cx(fieldClass, 'w-24')}
            value={field.value === 0 ? '' : String(field.value)}
            onBlur={field.onBlur}
            onChange={(e) => {
              const parsed = Number.parseInt(e.target.value, 10);
              field.onChange(Number.isNaN(parsed) ? 0 : Math.min(max, Math.max(0, parsed)));
            }}
          />
        </span>
      )}
    />
  );
};

const LogSearchForm = ({ onSubmit, developer = false }: LogSearchFormProps) => {
  const { t } = useTranslation();
  const resolver = useMemo(() => zodResolver(buildLogSearchSchema(t)), [t]);
  const { control, handleSubmit, reset, formState } = useForm<LogSearchFormValues>({
    defaultValues: LOG_SEARCH_DEFAULTS,
    resolver,
  });

  const searchError = formState.errors.userName?.message ?? formState.errors.pastDays?.message;

  const submit = handleSubmit((values) => {
    const completed = applyLogSearchDefaults(values, developer);
    reset(completed, { keepDefaultValues: true });
    onSubmit(completed);
  });

  return (
    <form
      className="mx-5 mb-3 flex shrink-0 flex-col gap-3 rounded-ui-lg border border-border-subtle bg-bg-surface p-3"
      onSubmit={submit}
      noValidate
    >
      <fieldset className="min-w-0">
        <legend className={cx(sectionLabelClass, 'float-left mb-1.5 w-full')}>{t('LogSearchForm.group.filters')}</legend>
        <div className="clear-both grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {TEXT_FILTERS.filter((name) => !developer || name !== 'ipAddress').map((name) => (
            <Controller
              key={name}
              name={name}
              control={control}
              render={({ field }) => (
                <TextInput
                  {...field}
                  icon={null}
                  maxLength={name === 'message' ? MAX_TEXT_LENGTH : MAX_NAME_LENGTH}
                  label={t(`LogSearchForm.label.${name}`)}
                />
              )}
            />
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <fieldset className="min-w-0">
          <legend className={cx(sectionLabelClass, 'float-left mb-1.5 w-full')}>{t('LogSearchForm.group.locations')}</legend>
          <div className="clear-both flex h-9 items-center gap-4">
            {LOCATIONS.filter((location) => !developer || location !== 'chat').map((location) => (
              <Controller
                key={location}
                name={`logLocation.${location}`}
                control={control}
                render={({ field }) => (
                  <Checkbox checked={field.value} onChange={field.onChange} label={t(LOCATION_LABEL_KEYS[location])} />
                )}
              />
            ))}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className={cx(sectionLabelClass, 'float-left mb-1.5 w-full')}>{t('LogSearchForm.group.dateRange')}</legend>
          <div className="clear-both flex items-center gap-4">
            <Controller
              name="dateRange"
              control={control}
              render={({ field }) => (
                <div className="flex h-9 items-center gap-3" role="radiogroup" aria-label={t('LogSearchForm.group.dateRange')}>
                  {(['pastDays', 'today', 'lastHour'] as const).map((range) => (
                    <label key={range} className="flex items-center gap-1.5 text-[13px] text-text-primary">
                      <input
                        type="radio"
                        className="h-4 w-4 accent-accent"
                        name={field.name}
                        value={range}
                        checked={field.value === range}
                        onChange={() => field.onChange(range)}
                      />
                      {t(`LogSearchForm.label.${range}`)}
                    </label>
                  ))}
                </div>
              )}
            />
            <NumberField control={control} name="pastDays" label={t('LogSearchForm.label.days')} max={LOG_MAX_DAYS} />
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className={cx(sectionLabelClass, 'float-left mb-1.5 w-full')}>{t('LogSearchForm.group.results')}</legend>
          <div className="clear-both">
            <NumberField
              control={control}
              name="maximumResults"
              label={t('LogSearchForm.label.maximumResults')}
              max={LOG_MAX_RESULTS}
            />
          </div>
        </fieldset>
        <div className="ml-auto flex items-center gap-2 self-end">
          <Button type="button" variant="quiet" onClick={() => reset(LOG_SEARCH_DEFAULTS)}>
            {t('LogSearchForm.button.clear')}
          </Button>
          <Button type="submit" variant="primary" icon={<Search size={14} aria-hidden />}>
            {t('LogSearchForm.button.search')}
          </Button>
        </div>
      </div>
      <p className="text-[12px] text-text-muted">{t('LogSearchForm.description')}</p>
      {searchError && <p role="alert" className="text-[12px] text-danger">{searchError}</p>}
    </form>
  );
};

export default LogSearchForm;
