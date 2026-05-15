import { vi } from 'vitest';

const settingsTable = vi.hoisted(() => ({
  mapToClass: vi.fn(),
  put: vi.fn(() => Promise.resolve('setting-key')),
  where: vi.fn(),
}));

vi.mock('../DexieService', () => ({
  dexieService: { settings: settingsTable },
}));

import { SettingDTO } from './SettingDTO';

describe('SettingDTO', () => {
  beforeEach(() => {
    settingsTable.put.mockClear();
    settingsTable.where.mockReset();
  });

  it('registers itself with the settings table on import', () => {
    expect(settingsTable.mapToClass).toHaveBeenCalledWith(SettingDTO);
  });

  it('constructs with the given user and default flags', () => {
    const setting = new SettingDTO('alice');
    expect(setting.user).toBe('alice');
    expect(setting.autoConnect).toBe(false);
    expect(setting.invertVerticalCoordinate).toBe(false);
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
