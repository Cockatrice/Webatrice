import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { SettingDTO } from '@app/services';
import { getSettings, settingsStore, useSettings, setPlaymatSettings } from '@app/hooks';
import { DEFAULT_PLAYMAT_SETTINGS, SETTINGS_VERSION } from '@app/types';
import { resetDexie } from './resetDexie';

beforeEach(async () => {
  vi.useRealTimers(); await resetDexie(); settingsStore.reset();
});
afterEach(() => localStorage.removeItem('webatrice.playmatSettings'));

it.each([true, false])('migrates and resets legacy playmats durably (existing typed row: %s)', async (existing) => {
  if (existing) {
    const row = new SettingDTO('*app');
    row.version = 2;
    await row.save();
  }
  localStorage.setItem('webatrice.playmatSettings', JSON.stringify({ visibility: 0,
    fallbackList: [{ cardName: 'Island' }] }));
  const loaded = await getSettings();
  expect(loaded.playmatSettings.visibility).toBe(0);
  expect(loaded.playmatSettings.fallbackList[0].cardName).toBe('Island');
  const persisted = await SettingDTO.get('*app');
  expect(persisted?.version).toBe(SETTINGS_VERSION);
  expect(persisted?.playmatSettings).toEqual(loaded.playmatSettings);
  expect(localStorage.getItem('webatrice.playmatSettings')).toBeNull();
  const { result, unmount } = renderHook(() => useSettings());
  await act(async () => {
    await result.current.update({ playmatSettings: structuredClone(DEFAULT_PLAYMAT_SETTINGS) });
  });
  unmount();
  settingsStore.reset();
  expect((await getSettings()).playmatSettings).toEqual(DEFAULT_PLAYMAT_SETTINGS);
  await setPlaymatSettings({ visibility: 1 });
  settingsStore.reset();
  expect((await getSettings()).playmatSettings.visibility).toBe(1);
});
