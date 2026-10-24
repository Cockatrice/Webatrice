import { useEffect, useId, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { TFunction } from 'i18next';
import { AlertTriangle, Plus, RefreshCw, Trash2, X } from 'lucide-react';

import type { Response_CardArtRuleEntry } from '@cockatrice/sockatrice/generated';
import { Button, Chip, IconButton } from '@app/components';
import {
  fieldClass,
  labelClass,
  sectionLabelClass,
  StaffConsole,
  StaffToolGuard,
  StaffDrawer,
  StaffHeader,
  StaffTable,
  type StaffColumn,
} from '@app/feature-wrappers/staff';

import { CARD_ART_RULE_MODES, useCardArtRules } from './useCardArtRules';

const MAX_FIELD_LENGTH = 0xff;

const errorClass = 'mx-5 mb-3 flex items-center gap-2 rounded-ui border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger';

const buildRuleSchema = (t: TFunction) =>
  z.object({
    cardName: z.string().trim()
      .min(1, t('Common.validation.required'))
      .max(MAX_FIELD_LENGTH, t('CardArtRules.validation.tooLong', { max: MAX_FIELD_LENGTH })),
    cardProviderId: z.string().trim()
      .max(MAX_FIELD_LENGTH, t('CardArtRules.validation.tooLong', { max: MAX_FIELD_LENGTH })),
    mode: z.enum(CARD_ART_RULE_MODES),
    reason: z.string(),
  });

type RuleFormValues = z.infer<ReturnType<typeof buildRuleSchema>>;

const DEFAULT_VALUES: RuleFormValues = { cardName: '', cardProviderId: '', mode: 'ALLOW', reason: '' };

interface RuleRow {
  index: number;
  rule: Response_CardArtRuleEntry;
}

const ModeChip = ({ mode }: { mode: string }) => (
  <Chip tone={mode === 'DENY' ? 'danger' : 'success'}>{mode}</Chip>
);

const FieldError = ({ message }: { message?: string }) =>
  (message ? <span role="alert" className="text-[12px] text-danger">{message}</span> : null);

const CardArtRulesContent = () => {
  const { t } = useTranslation();
  const rulesState = useCardArtRules();
  const { rules, selectedIndex, printings, defaultProviderId } = rulesState;
  const selected = selectedIndex === null ? undefined : rules[selectedIndex];
  const ids = { card: useId(), provider: useId(), mode: useId(), reason: useId() };

  const resolver = useMemo(() => zodResolver(buildRuleSchema(t)), [t]);
  const { control, handleSubmit, setValue } = useForm<RuleFormValues>({ defaultValues: DEFAULT_VALUES, resolver });

  useEffect(() => {
    setValue('cardProviderId', defaultProviderId);
  }, [defaultProviderId, setValue]);

  const rows = useMemo<RuleRow[]>(() => rules.map((rule, index) => ({ index, rule })), [rules]);
  const columns = useMemo<StaffColumn<RuleRow>[]>(() => [
    {
      id: 'card', header: t('CardArtRules.column.card'), sortValue: (r) => r.rule.cardName.toLowerCase(),
      render: (r) => <span className="font-medium">{r.rule.cardName}</span>,
    },
    {
      id: 'provider', header: t('CardArtRules.column.providerId'), width: 'w-[300px]',
      render: (r) => <span className="font-mono text-[12px] text-text-secondary">{r.rule.cardProviderId}</span>,
    },
    {
      id: 'mode', header: t('CardArtRules.column.mode'), width: 'w-[96px]', sortValue: (r) => r.rule.mode,
      render: (r) => <ModeChip mode={r.rule.mode} />,
    },
    { id: 'reason', header: t('CardArtRules.column.reason'), render: (r) => <span className="text-text-secondary">{r.rule.reason}</span> },
  ], [t]);

  return (
    <>
      <StaffHeader
        title={t('CardArtRules.title')}
        subtitle={t('CardArtRules.subtitle')}
        actions={(
          <IconButton label={t('CardArtRules.button.refresh')} onClick={rulesState.refresh}>
            <RefreshCw size={15} aria-hidden />
          </IconButton>
        )}
      />
      {rulesState.error && (
        <div role="alert" className={errorClass}>
          <AlertTriangle size={15} aria-hidden />
          <span className="flex-1">{rulesState.error}</span>
          <IconButton size="sm" label={t('CardArtRules.button.dismiss')} onClick={rulesState.dismissError}>
            <X size={14} aria-hidden />
          </IconButton>
        </div>
      )}
      <div className="flex min-h-0 flex-1 border-t border-border-subtle">
        <StaffTable
          label={t('CardArtRules.title')}
          columns={columns}
          rows={rows}
          rowKey={(r) => String(r.index)}
          selectedKey={selectedIndex === null ? null : String(selectedIndex)}
          onSelect={(key) => rulesState.select(Number(key))}
          status={rows.length === 0 ? t('CardArtRules.empty') : undefined}
          footer={t('CardArtRules.count', { count: rows.length })}
        />
        <StaffDrawer
          label={t('CardArtRules.drawer')}
          title={(
            <span className="font-display text-[17px] font-semibold text-text-primary">
              {selected ? selected.cardName : t('CardArtRules.noSelection')}
            </span>
          )}
          subtitle={selected ? selected.cardProviderId || t('CardArtRules.anyPrinting') : t('CardArtRules.noSelectionHint')}
          actions={(
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={13} aria-hidden />}
              disabled={selectedIndex === null}
              onClick={rulesState.removeSelected}
            >
              {t('CardArtRules.button.remove')}
            </Button>
          )}
        >
          {selected && (
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-secondary">
              <ModeChip mode={selected.mode} />
              <span className="break-words">{selected.reason || t('CardArtRules.noReason')}</span>
            </div>
          )}
          <form
            className="flex flex-col gap-3 rounded-ui border border-border-subtle p-3"
            onSubmit={handleSubmit(rulesState.addRule)}
            noValidate
          >
            <h2 className={sectionLabelClass}>{t('CardArtRules.addTitle')}</h2>
            <Controller
              name="cardName"
              control={control}
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1">
                  <label htmlFor={ids.card} className={labelClass}>{t('CardArtRules.label.card')}</label>
                  <input
                    {...field}
                    id={ids.card}
                    className={fieldClass}
                    placeholder={t('CardArtRules.label.cardPlaceholder')}
                    maxLength={MAX_FIELD_LENGTH}
                    aria-invalid={Boolean(fieldState.error)}
                    onChange={(event) => {
                      field.onChange(event);
                      rulesState.lookUpPrintings(event.target.value);
                    }}
                    onBlur={() => {
                      field.onBlur();
                      rulesState.lookUpPrintings(field.value);
                    }}
                  />
                  <FieldError message={fieldState.error?.message} />
                </div>
              )}
            />
            <Controller
              name="cardProviderId"
              control={control}
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1">
                  <label htmlFor={ids.provider} className={labelClass}>{t('CardArtRules.label.providerId')}</label>
                  {printings.length > 0 ? (
                    <select {...field} id={ids.provider} className={fieldClass} disabled={rulesState.printingsPending}>
                      {printings.map((printing) => (
                        <option key={printing.providerId} value={printing.providerId}>{printing.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      {...field}
                      id={ids.provider}
                      className={fieldClass}
                      maxLength={MAX_FIELD_LENGTH}
                      disabled={rulesState.printingsPending}
                      aria-invalid={Boolean(fieldState.error)}
                    />
                  )}
                  <FieldError message={fieldState.error?.message} />
                </div>
              )}
            />
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <Controller
                name="mode"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <label htmlFor={ids.mode} className={labelClass}>{t('CardArtRules.label.mode')}</label>
                    <select {...field} id={ids.mode} className={fieldClass}>
                      {CARD_ART_RULE_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                    </select>
                  </div>
                )}
              />
              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <label htmlFor={ids.reason} className={labelClass}>{t('CardArtRules.label.reason')}</label>
                    <input {...field} id={ids.reason} className={fieldClass} />
                  </div>
                )}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              className="self-start"
              icon={<Plus size={14} aria-hidden />}
              disabled={rulesState.printingsPending}
            >
              {t('CardArtRules.button.add')}
            </Button>
          </form>
        </StaffDrawer>
      </div>
    </>
  );
};

const CardArtRules = () => (
  <StaffConsole>
    <StaffToolGuard tool="cardArtRules">
      <CardArtRulesContent />
    </StaffToolGuard>
  </StaffConsole>
);

export default CardArtRules;
