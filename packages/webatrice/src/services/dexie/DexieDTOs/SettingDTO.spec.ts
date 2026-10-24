import { vi } from 'vitest';

const settingsTable = vi.hoisted(() => ({
  mapToClass: vi.fn(),
  put: vi.fn(() => Promise.resolve('setting-key')),
  where: vi.fn(),
}));

vi.mock('../DexieService', () => ({
  dexieService: { settings: settingsTable },
}));

import { PREFERENCE_DEFAULTS, SETTINGS_VERSION } from '@app/types';
import { SettingDTO } from './SettingDTO';

const mapToClassCalls = [...settingsTable.mapToClass.mock.calls];

describe('SettingDTO', () => {
  beforeEach(() => {
    settingsTable.put.mockClear();
    settingsTable.where.mockReset();
  });

  it('registers itself with the settings table on import', () => {
    expect(mapToClassCalls).toEqual([[SettingDTO]]);
  });

  it('constructs with the given user, the current schema version and every preference default', () => {
    const setting = new SettingDTO('alice');
    expect(setting.user).toBe('alice');
    expect(setting.version).toBe(SETTINGS_VERSION);
    expect(setting).toMatchObject(PREFERENCE_DEFAULTS);
  });

  it('does not share array defaults between instances', () => {
    const a = new SettingDTO('a');
    (a.messageMacros as string[]).push('gg');
    expect(new SettingDTO('b').messageMacros).toEqual([]);
  });

  it('save() puts the instance into the settings table', async () => {
    const setting = new SettingDTO('bob');
    const result = await setting.save();
    expect(settingsTable.put).toHaveBeenCalledWith(setting);
    expect(result).toBe('setting-key');
  });

  it('get() looks up a setting by user (case-insensitive)', async () => {
    const first = vi.fn(() => Promise.resolve({ user: 'carol' }));
    const equalsIgnoreCase = vi.fn(() => ({ first }));
    settingsTable.where.mockReturnValue({ equalsIgnoreCase });

    const result = await SettingDTO.get('carol');

    expect(settingsTable.where).toHaveBeenCalledWith('user');
    expect(equalsIgnoreCase).toHaveBeenCalledWith('carol');
    expect(result).toEqual({ user: 'carol' });
  });
});
