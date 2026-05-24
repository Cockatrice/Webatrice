import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingDTO } from '@app/services';
import { APP_USER } from '@app/types';
import { resetDexie } from './resetDexie';

beforeEach(async () => {
  // Shared setup.ts installs vi.useFakeTimers() for the websocket suite's
  // KeepAliveService needs. Dexie + fake-indexeddb rely on real microtasks
  // and will hang under fake timers, so flip back here.
  vi.useRealTimers();
  await resetDexie();
});

describe('SettingDTO (real Dexie)', () => {
  it('returns undefined for a user with no row yet', async () => {
    const loaded = await SettingDTO.get(APP_USER);
    expect(loaded).toBeUndefined();
  });

  it('round-trips a fresh setting via save()', async () => {
    const dto = new SettingDTO(APP_USER);
    dto.autoConnect = true;
    await dto.save();

    const loaded = await SettingDTO.get(APP_USER);
    expect(loaded).toBeDefined();
    expect(loaded!.user).toBe(APP_USER);
    expect(loaded!.autoConnect).toBe(true);
  });

  it('upserts on repeated save for the same user key', async () => {
    const first = new SettingDTO(APP_USER);
    first.autoConnect = false;
    await first.save();

    const loaded = await SettingDTO.get(APP_USER);
    loaded!.autoConnect = true;
    await loaded!.save();

    const reloaded = await SettingDTO.get(APP_USER);
    expect(reloaded!.autoConnect).toBe(true);
  });

  it('matches user lookups case-insensitively (equalsIgnoreCase in DTO.get)', async () => {
    const dto = new SettingDTO(APP_USER);
    await dto.save();

    const loaded = await SettingDTO.get(APP_USER.toUpperCase());
    expect(loaded).toBeDefined();
    expect(loaded!.user).toBe(APP_USER);
  });

  it('preserves the SettingDTO class on load (mapToClass binding)', async () => {
    const dto = new SettingDTO(APP_USER);
    await dto.save();

    const loaded = await SettingDTO.get(APP_USER);
    expect(loaded).toBeInstanceOf(SettingDTO);
    // The save() instance method must be present on the retrieved row so
    // call sites (useSettings.update) can round-trip without reinstantiation.
    expect(typeof loaded!.save).toBe('function');
  });
});
