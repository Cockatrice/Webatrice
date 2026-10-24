import { vi } from 'vitest';

const settingsTable = vi.hoisted(() => ({
  mapToClass: vi.fn(),
  put: vi.fn(() => Promise.resolve('singleton')),
  get: vi.fn<() => Promise<unknown>>(() => Promise.resolve(undefined)),
}));

const readWrite = vi.hoisted(() => vi.fn((_tables: unknown[], work: () => Promise<unknown>) => work()));

vi.mock('../DexieService', () => ({
  dexieService: { cardDataSettings: settingsTable, readWrite },
}));

import { DEFAULT_PICTURE_URL_TEMPLATES } from '../../cardDatabase/pictureUrlTemplates';
import { CardDataSettingsDTO } from './CardDataSettingsDTO';

describe('CardDataSettingsDTO', () => {
  it('falls back to desktop defaults when nothing is stored', async () => {
    const settings = await CardDataSettingsDTO.get();
    expect(settings.id).toBe('singleton');
    expect(settings.cardOverrides).toEqual({});
    expect(settings.pictureUrlTemplates).toEqual(DEFAULT_PICTURE_URL_TEMPLATES);
    expect(settings.alwaysEnableNewSets).toBe(false);
  });

  it('returns the stored row with defaults filled in', async () => {
    settingsTable.get.mockResolvedValueOnce({ id: 'singleton', pictureUrlTemplates: ['https://x/!name!'] });
    const settings = await CardDataSettingsDTO.get();
    expect(settings.pictureUrlTemplates).toEqual(['https://x/!name!']);
    expect(settings.alwaysEnableNewSets).toBe(false);
  });

  it('does not share the default template array between instances', () => {
    const a = new CardDataSettingsDTO();
    a.pictureUrlTemplates.push('https://x');
    expect(new CardDataSettingsDTO().pictureUrlTemplates).toEqual(DEFAULT_PICTURE_URL_TEMPLATES);
  });

  it('saves itself to the singleton row', async () => {
    const settings = new CardDataSettingsDTO({ alwaysEnableNewSets: true });
    await settings.save();
    expect(settingsTable.put).toHaveBeenCalledWith(settings);
  });

  it('sets and removes one exact-name override without changing the others', async () => {
    settingsTable.get.mockResolvedValue({
      id: 'singleton',
      cardOverrides: { Bolt: 'old', Counterspell: 'keep' },
    });

    await CardDataSettingsDTO.setCardOverride('Bolt', 'new');
    expect(settingsTable.put).toHaveBeenLastCalledWith(expect.objectContaining({
      cardOverrides: { Bolt: 'new', Counterspell: 'keep' },
    }));

    settingsTable.get.mockResolvedValue({
      id: 'singleton',
      cardOverrides: { Bolt: 'new', Counterspell: 'keep' },
    });
    await CardDataSettingsDTO.setCardOverride('Bolt', undefined);
    expect(settingsTable.put).toHaveBeenLastCalledWith(expect.objectContaining({
      cardOverrides: { Counterspell: 'keep' },
    }));
    expect(readWrite).toHaveBeenCalledTimes(2);
  });
});
