import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Check, ChevronDown, ChevronRight, Crown, Eye, Heart, Lock, Swords, UsersRound } from 'lucide-react';

import { server, type GametypeMap } from '@cockatrice/datatrice';
import type { CreateGameParams } from '@cockatrice/sockatrice/generated';
import { Button, Checkbox, SectionLabel, TextInput, Toggle } from '@app/components';
import { DialogShell } from '@app/dialogs';
import { useAppSelector } from '@app/store';
import { cx } from '@app/utils';

import {
  CREATE_GAME_PRESETS,
  MAX_PLAYERS_RANGE,
  STARTING_LIFE_RANGE,
  advancedSettingCount,
  isPresetAvailable,
  type CreateGamePreset,
  type CreateGameSummary,
  type InvalidField,
  type PresetId,
} from './createGamePresets';
import { useCreateGameForm } from './useCreateGameForm';

export interface CreateGameDialogProps {
  isOpen: boolean;
  roomName: string;
  gametypeMap: GametypeMap;
  onCancel: () => void;
  onSubmit: (params: CreateGameParams) => void;
}

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const PRESET_ICONS: Record<PresetId, ReactNode> = {
  commanderPod: <UsersRound size={18} aria-hidden />,
  oneVsOne: <Swords size={18} aria-hidden />,
  friendsOnly: <Heart size={18} aria-hidden />,
  duelCommander: <Crown size={18} aria-hidden />,
};

function presetName(t: TFunction, id: PresetId): string {
  switch (id) {
    case 'commanderPod':
      return t('CreateGameDialog.preset.commanderPod.name');
    case 'oneVsOne':
      return t('CreateGameDialog.preset.oneVsOne.name');
    case 'friendsOnly':
      return t('CreateGameDialog.preset.friendsOnly.name');
    case 'duelCommander':
      return t('CreateGameDialog.preset.duelCommander.name');
  }
}

function summaryText(t: TFunction, summary: CreateGameSummary): string {
  const yesNo = (value: boolean) => (value ? 'yes' : 'no');
  const parts = [
    t('CreateGameDialog.summary.game', {
      seats: summary.seats,
      audience: summary.audience,
      password: yesNo(summary.hasPassword),
      life: summary.life,
      hasFormat: yesNo(summary.format != null),
      format: summary.format ?? '',
    }),
    t('CreateGameDialog.summary.watch', {
      allowed: yesNo(summary.spectators != null),
      chat: yesNo(Boolean(summary.spectators?.canTalk)),
      seeAll: yesNo(Boolean(summary.spectators?.seeEverything)),
      needPassword: yesNo(Boolean(summary.spectators?.needPassword)),
    }),
  ];
  if (summary.shareDecklists) {
    parts.push(t('CreateGameDialog.summary.decklists'));
  }
  if (summary.hostWatches) {
    parts.push(t('CreateGameDialog.summary.hostWatches'));
  }
  if (summary.hostJudges) {
    parts.push(t('CreateGameDialog.summary.hostJudges'));
  }
  return parts.join(' ');
}

function PresetCard({
  preset,
  name,
  note,
  group,
  checked,
  customised,
  disabled,
  onPick,
}: {
  preset: CreateGamePreset;
  name: string;
  note: string | null;
  group: string;
  checked: boolean;
  customised: boolean;
  disabled: boolean;
  onPick: (preset: CreateGamePreset) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <label
      className={cx(
        'flex flex-col gap-1.5 rounded-ui border p-3 text-left',
        'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
        'has-[:focus-visible]:outline-accent',
        checked ? 'border-accent bg-accent/10' : 'border-border-subtle',
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:border-accent/60',
      )}
    >
      <input
        type="radio"
        name={group}
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={() => onPick(preset)}
        onClick={() => onPick(preset)}
        aria-labelledby={`${id}-name`}
        aria-describedby={[note && `${id}-note`, customised && `${id}-customised`].filter(Boolean).join(' ') || undefined}
      />
      <span className={cx('flex items-center gap-2', checked ? 'text-accent' : 'text-text-secondary')}>
        {PRESET_ICONS[preset.id]}
        {customised && (
          <span id={`${id}-customised`} className="ml-auto text-[11px] font-medium text-text-secondary">
            {t('CreateGameDialog.preset.customised')}
          </span>
        )}
        {checked && <Check size={14} className={customised ? undefined : 'ml-auto'} aria-hidden />}
      </span>
      <span id={`${id}-name`} className="text-[13.5px] font-semibold text-text-primary">{name}</span>
      {note && <span id={`${id}-note`} className="text-[12px] leading-snug text-text-muted">{note}</span>}
    </label>
  );
}

function CreateGameDialog({ isOpen, roomName, gametypeMap, onCancel, onSubmit }: CreateGameDialogProps) {
  const { t } = useTranslation();
  const formId = useId();
  const presetGroup = useId();
  const advancedId = useId();
  const isRegistered = useAppSelector(server.Selectors.getIsUserRegistered);
  const isJudge = useAppSelector(server.Selectors.getIsUserJudge);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const revealAdvanced = useRef(false);
  const advancedRef = useRef<HTMLDivElement>(null);
  const maxPlayersRef = useRef<HTMLInputElement>(null);
  const lifeRef = useRef<HTMLInputElement>(null);
  const [focusField, setFocusField] = useState<InvalidField | null>(null);
  const {
    form,
    update,
    pickPreset,
    pickedPreset,
    customised,
    invalidField,
    summary,
    remember,
    setRemember,
    submit,
  } = useCreateGameForm({ isOpen, gametypeMap, isRegistered, isJudge });

  const gameTypes = useMemo(
    () => Object.entries(gametypeMap).map(([id, name]) => ({ id: Number(id), name })),
    [gametypeMap],
  );

  useEffect(() => {
    if (isOpen) {
      setAdvancedOpen(true);
    }
  }, [isOpen]);

  const toggleAdvanced = () => {
    revealAdvanced.current = !advancedOpen;
    setAdvancedOpen(!advancedOpen);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = submit();
    if ('params' in result) {
      onSubmit(result.params);
    } else {
      setAdvancedOpen(true);
      setFocusField(result.field);
    }
  };

  useEffect(() => {
    if (!focusField || !advancedOpen) {
      return;
    }
    (focusField === 'maxPlayers' ? maxPlayersRef : lifeRef).current?.focus();
    setFocusField(null);
  }, [focusField, advancedOpen]);

  useEffect(() => {
    if (advancedOpen && revealAdvanced.current) {
      revealAdvanced.current = false;
      advancedRef.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [advancedOpen]);

  const spectatorsOff = !form.spectatorsAllowed;

  return (
    <DialogShell
      isOpen={isOpen}
      handleClose={onCancel}
      title={t('CreateGameDialog.title', { room: roomName })}
      maxWidth="max-w-[760px]"
      footer={
        <>
          <Checkbox
            className="mr-auto"
            checked={remember}
            onChange={setRemember}
            label={<span className="text-text-secondary">{t('CreateGameDialog.label.remember')}</span>}
          />
          <Button variant="quiet" onClick={onCancel}>{t('Common.action.cancel')}</Button>
          <Button variant="primary" type="submit" form={formId}>{t('CreateGameDialog.action.create')}</Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset>
          <legend>
            <SectionLabel>{t('CreateGameDialog.startFrom')}</SectionLabel>
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CREATE_GAME_PRESETS.map((preset) => {
              const available = isPresetAvailable(preset, isRegistered);
              return (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  name={presetName(t, preset.id)}
                  note={available ? null : t('CreateGameDialog.preset.needsAccount')}
                  group={presetGroup}
                  checked={pickedPreset === preset.id}
                  customised={pickedPreset === preset.id && customised}
                  disabled={!available}
                  onPick={pickPreset}
                />
              );
            })}
          </div>
        </fieldset>

        <div className={cx('grid gap-3', gameTypes.length > 0 && 'sm:grid-cols-[1fr_200px]')}>
          <TextInput
            icon={null}
            data-autofocus
            label={t('CreateGameDialog.label.description')}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
          {gameTypes.length > 0 && (
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[12px] font-medium text-text-secondary">{t('CreateGameDialog.label.format')}</span>
              <span className="relative flex">
                <select
                  value={form.gameTypeId ?? ''}
                  onChange={(e) => update('gameTypeId', e.target.value === '' ? null : Number(e.target.value))}
                  className={cx(
                    'h-9 w-full min-w-0 appearance-none truncate rounded-ui border border-border-control bg-bg-sunken',
                    'pl-2.5 pr-8 text-[13px] text-text-primary focus:border-accent',
                    FOCUS_RING,
                  )}
                >
                  <option value="">{t('CreateGameDialog.format.any')}</option>
                  {gameTypes.map(({ id, name }) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  aria-hidden
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                />
              </span>
            </label>
          )}
        </div>

        <TextInput
          icon={<Lock size={14} aria-hidden />}
          type="password"
          autoComplete="new-password"
          label={t('CreateGameDialog.label.password')}
          placeholder={t('CreateGameDialog.placeholder.password')}
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
        />

        <p className="rounded-ui border border-border-subtle bg-bg-sunken px-3.5 py-2.5 text-[13px] leading-relaxed text-text-secondary">
          <Eye size={14} aria-hidden className="mr-1.5 inline align-[-2px] text-text-muted" />
          {summaryText(t, summary)}
        </p>

        <div className="rounded-ui border border-border-subtle">
          <button
            type="button"
            aria-expanded={advancedOpen}
            aria-controls={advancedId}
            onClick={toggleAdvanced}
            className={cx('flex w-full flex-wrap items-center gap-x-2 rounded-ui px-3.5 py-2.5 text-left', FOCUS_RING)}
          >
            {advancedOpen
              ? <ChevronDown size={16} aria-hidden className="text-text-muted" />
              : <ChevronRight size={16} aria-hidden className="text-text-muted" />}
            <span className="text-[13.5px] font-semibold text-text-primary">{t('CreateGameDialog.advanced.title')}</span>
            <span className="ml-auto text-[12px] text-accent">
              {advancedOpen
                ? t('CreateGameDialog.advanced.hide')
                : t('CreateGameDialog.advanced.show', { count: advancedSettingCount(isJudge) })}
            </span>
          </button>
          {advancedOpen && (
            <div
              ref={advancedRef}
              id={advancedId}
              className="grid gap-x-6 gap-y-4 border-t border-border-subtle px-3.5 py-3 sm:grid-cols-3"
            >
              <div className="flex flex-col gap-2">
                <SectionLabel>{t('CreateGameDialog.section.table')}</SectionLabel>
                <TextInput
                  icon={null}
                  type="number"
                  min={MAX_PLAYERS_RANGE.min}
                  max={MAX_PLAYERS_RANGE.max}
                  ref={maxPlayersRef}
                  label={t('CreateGameDialog.label.maxPlayers')}
                  value={form.maxPlayers}
                  aria-invalid={invalidField === 'maxPlayers' || undefined}
                  aria-describedby={invalidField === 'maxPlayers' ? `${formId}-error` : undefined}
                  onChange={(e) => update('maxPlayers', Number(e.target.value))}
                />
                {invalidField === 'maxPlayers' && (
                  <span id={`${formId}-error`} role="alert" className="text-[12px] text-danger">
                    {t('CreateGameDialog.error.range', MAX_PLAYERS_RANGE)}
                  </span>
                )}
                <TextInput
                  icon={null}
                  type="number"
                  min={STARTING_LIFE_RANGE.min}
                  max={STARTING_LIFE_RANGE.max}
                  ref={lifeRef}
                  label={t('CreateGameDialog.label.startingLifeTotal')}
                  value={form.startingLifeTotal}
                  aria-invalid={invalidField === 'startingLifeTotal' || undefined}
                  aria-describedby={invalidField === 'startingLifeTotal' ? `${formId}-error` : undefined}
                  onChange={(e) => update('startingLifeTotal', Number(e.target.value))}
                />
                {invalidField === 'startingLifeTotal' && (
                  <span id={`${formId}-error`} role="alert" className="text-[12px] text-danger">
                    {t('CreateGameDialog.error.range', STARTING_LIFE_RANGE)}
                  </span>
                )}
              </div>
              <div role="group" aria-label={t('CreateGameDialog.section.whoCanJoin')} className="flex flex-col gap-2.5">
                <SectionLabel>{t('CreateGameDialog.section.whoCanJoin')}</SectionLabel>
                <Toggle
                  checked={form.onlyRegistered}
                  onChange={(v) => update('onlyRegistered', v)}
                  label={t('CreateGameDialog.label.onlyRegistered')}
                />
                <Toggle
                  checked={form.onlyBuddies}
                  onChange={(v) => update('onlyBuddies', v)}
                  disabled={!isRegistered}
                  label={t('CreateGameDialog.label.onlyBuddies')}
                />
                <Toggle
                  checked={form.shareDecklistsOnLoad}
                  onChange={(v) => update('shareDecklistsOnLoad', v)}
                  label={t('CreateGameDialog.label.shareDecklistsOnLoad')}
                />
                <Toggle
                  checked={form.joinAsSpectator}
                  onChange={(v) => update('joinAsSpectator', v)}
                  label={t('CreateGameDialog.label.joinAsSpectator')}
                />
                {isJudge && (
                  <Toggle
                    checked={form.joinAsJudge}
                    onChange={(v) => update('joinAsJudge', v)}
                    label={t('CreateGameDialog.label.joinAsJudge')}
                  />
                )}
              </div>
              <div role="group" aria-label={t('CreateGameDialog.section.spectators')} className="flex flex-col gap-2.5">
                <SectionLabel>{t('CreateGameDialog.section.spectators')}</SectionLabel>
                <Toggle
                  checked={form.spectatorsAllowed}
                  onChange={(v) => update('spectatorsAllowed', v)}
                  label={t('CreateGameDialog.label.spectatorsAllowed')}
                />
                <Toggle
                  checked={form.spectatorsCanTalk}
                  onChange={(v) => update('spectatorsCanTalk', v)}
                  disabled={spectatorsOff}
                  label={t('CreateGameDialog.label.spectatorsCanTalk')}
                />
                <Toggle
                  checked={form.spectatorsSeeEverything}
                  onChange={(v) => update('spectatorsSeeEverything', v)}
                  disabled={spectatorsOff}
                  label={t('CreateGameDialog.label.spectatorsSeeEverything')}
                />
                <Toggle
                  checked={form.spectatorsNeedPassword}
                  onChange={(v) => update('spectatorsNeedPassword', v)}
                  disabled={spectatorsOff}
                  label={t('CreateGameDialog.label.spectatorsNeedPassword')}
                />
              </div>
            </div>
          )}
        </div>
      </form>
    </DialogShell>
  );
}

export default CreateGameDialog;
