import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { games } from '@cockatrice/datatrice';
import {
  getPlaymatSettings,
  setPlaymatSettings,
  usePlaymatSettingsState,
  type PlaymatSettings,
} from '@app/hooks';
import { CardDTO } from '@app/services';
import { PLAYMAT_NAME_MAX_LENGTH } from '@app/types';

import type { SubmitResult } from './ArtParts';
import { movePlaymat } from './playmatList';

export function usePlaymatSave() {
  const [settings, save] = usePlaymatSettingsState();
  const [saveError, setSaveError] = useState(false);
  const update = (patch: Partial<PlaymatSettings>) => {
    setSaveError(false);
    return save(patch).catch(() => {
      setSaveError(true);
    });
  };
  return { settings, update, saveError, setSaveError };
}

export function usePlaymatCollection() {
  const { t } = useTranslation();
  const { settings, update, saveError, setSaveError } = usePlaymatSave();
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [committing, setCommitting] = useState(false);
  const list = settings.fallbackList;
  const editingPlaymat = editing !== null ? list[editing] : undefined;
  const operation = useRef(0);
  const committingRef = useRef(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const cropButtons = useRef(new Map<number, HTMLButtonElement>());
  const pendingFocus = useRef<'add' | number | null>(null);

  useEffect(() => () => {
    operation.current += 1;
  }, []);

  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) {
      return;
    }
    pendingFocus.current = null;
    (target === 'add' ? addButton.current : cropButtons.current.get(target))?.focus();
  });

  const registerCropButton = useCallback((index: number, element: HTMLButtonElement | null) => {
    if (element) {
      cropButtons.current.set(index, element);
    } else {
      cropButtons.current.delete(index);
    }
  }, []);

  const cancelAdd = () => {
    if (committingRef.current) {
      return;
    }
    operation.current += 1;
    pendingFocus.current = 'add';
    setAdding(false);
  };
  const toggleAdd = () => (adding ? cancelAdd() : setAdding(true));
  const closeCrop = () => {
    pendingFocus.current = editing;
    setEditing(null);
  };
  const toggleCrop = (index: number) => setEditing(editing === index ? null : index);

  const setList = (next: games.Playmat[]) => update({ fallbackList: next });
  const move = (from: number, to: number) => {
    void setList(movePlaymat(list, from, to));
    setEditing((current) => (current === from ? to : current === to ? from : current));
  };
  const remove = (index: number) => {
    void setList(list.filter((_, i) => i !== index));
    setEditing(null);
  };
  const setCrop = (params: games.PlaymatParams) => {
    void setList(list.map((entry, i) => (i === editing ? { ...entry, params } : entry)));
  };

  const commit = async (cardName: string): Promise<number | null> => {
    const current = getPlaymatSettings().fallbackList;
    committingRef.current = true;
    setCommitting(true);
    try {
      await setPlaymatSettings({
        fallbackList: [...current, { cardName, cardProviderId: '', params: games.DEFAULT_PLAYMAT_PARAMS }],
      });
      return current.length;
    } catch {
      setSaveError(true);
      return null;
    } finally {
      committingRef.current = false;
      setCommitting(false);
    }
  };

  const add = async (cardName: string): Promise<SubmitResult> => {
    const op = ++operation.current;
    const live = () => op === operation.current;
    setSaveError(false);
    let card: CardDTO | undefined;
    try {
      card = await CardDTO.get(cardName);
    } catch {
      return { ok: false, error: live() ? t('PlaymatSettings.validation.lookupFailed') : undefined };
    }
    if (!live()) {
      return { ok: false };
    }
    if (!card?.name?.value || card.name.value.length > PLAYMAT_NAME_MAX_LENGTH) {
      return { ok: false, error: t('PlaymatSettings.validation.unknownCard') };
    }
    const index = await commit(card.name.value);
    if (index === null) {
      return { ok: false };
    }
    if (live()) {
      pendingFocus.current = index;
      setAdding(false);
      setEditing(index);
    }
    return { ok: true };
  };

  return {
    list,
    editing,
    editingPlaymat,
    adding,
    committing,
    saveError,
    addButton,
    registerCropButton,
    toggleAdd,
    cancelAdd,
    closeCrop,
    toggleCrop,
    move,
    remove,
    setCrop,
    add,
  };
}
