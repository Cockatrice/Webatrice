import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CreateGameParams } from '@cockatrice/sockatrice/generated';

import {
  initialCreateGameForm,
  initialPresetId,
  readCreateGameDefaults,
  writeCreateGameDefaults,
} from './createGameDefaults';
import {
  applyPreset,
  defaultCreateGameForm,
  findPreset,
  invalidCreateGameField,
  matchingPreset,
  presetMatches,
  summarizeCreateGame,
  toCreateGameParams,
  type CreateGameForm,
  type CreateGamePreset,
  type InvalidField,
  type PresetId,
} from './createGamePresets';

export type CreateGameSubmission = { params: CreateGameParams } | { field: InvalidField };

export interface UseCreateGameFormArgs {
  isOpen: boolean;
  gametypeMap: Record<number, string>;
  isRegistered: boolean;
  isJudge: boolean;
}

export function useCreateGameForm({ isOpen, gametypeMap, isRegistered, isJudge }: UseCreateGameFormArgs) {
  const [form, setForm] = useState<CreateGameForm>(() => defaultCreateGameForm(isRegistered));
  const [pickedPreset, setPickedPreset] = useState<PresetId | null>(() =>
    matchingPreset(defaultCreateGameForm(isRegistered), { gametypeMap, isRegistered }));
  const [remember, setRemember] = useState(true);
  const [invalidField, setInvalidField] = useState<InvalidField | null>(null);
  const gametypeMapRef = useRef(gametypeMap);
  gametypeMapRef.current = gametypeMap;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const ctx = { gametypeMap: gametypeMapRef.current, isRegistered };
    const stored = readCreateGameDefaults();
    const initial = initialCreateGameForm(stored, ctx);
    setRemember(stored.remember);
    setForm(initial);
    setPickedPreset(initialPresetId(stored, initial, ctx));
    setInvalidField(null);
  }, [isOpen, isRegistered]);

  const update = useCallback(<K extends keyof CreateGameForm>(key: K, value: CreateGameForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setInvalidField((prev) => (prev === key ? null : prev));
  }, []);

  const pickPreset = useCallback(
    (preset: CreateGamePreset) => {
      setPickedPreset(preset.id);
      setForm((prev) => applyPreset(prev, preset, { gametypeMap, isRegistered }));
      setInvalidField(null);
    },
    [gametypeMap, isRegistered],
  );

  const picked = findPreset(pickedPreset);
  const customised = picked != null && !presetMatches(form, picked, { gametypeMap, isRegistered });
  const summary = useMemo(() => summarizeCreateGame(form, { gametypeMap, isJudge }), [form, gametypeMap, isJudge]);

  const submit = useCallback((): CreateGameSubmission => {
    const invalid = invalidCreateGameField(form);
    setInvalidField(invalid);
    if (invalid) {
      return { field: invalid };
    }
    writeCreateGameDefaults(remember, form, gametypeMap, pickedPreset);
    return { params: toCreateGameParams(form, isJudge) };
  }, [form, gametypeMap, isJudge, pickedPreset, remember]);

  return {
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
  };
}
