const hoisted = vi.hoisted(() => ({
  setPreferences: vi.fn(),
  sets: vi.fn(),
  settings: vi.fn(),
}));

vi.mock('../dexie/DexieDTOs', () => ({
  SetPreferenceDTO: { getAll: hoisted.setPreferences },
  CardDataSettingsDTO: { get: hoisted.settings },
}));
vi.mock('../dexie/DexieService', () => ({
  dexieService: { sets: { toArray: hoisted.sets } },
}));

describe('currentCardDataPreferences', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    hoisted.setPreferences.mockResolvedValue([]);
    hoisted.sets.mockResolvedValue([]);
  });

  const load = () => import('./cardDataPreferences');

  it('loads once and returns the same snapshot until a refresh', async () => {
    hoisted.settings.mockResolvedValue({ pictureUrlTemplates: ['https://a/!name!'] });
    const { currentCardDataPreferences } = await load();

    const first = await currentCardDataPreferences();
    expect(await currentCardDataPreferences()).toBe(first);
    expect(hoisted.settings).toHaveBeenCalledTimes(1);
    expect(first.pictureUrlTemplates).toEqual(['https://a/!name!']);
  });

  it('carries exact-name card overrides in the shared snapshot', async () => {
    hoisted.settings.mockResolvedValue({
      cardOverrides: { Bolt: 'printing-id' },
      pictureUrlTemplates: [],
    });
    const { currentCardDataPreferences, getCardPreferenceOverride } = await load();

    expect((await currentCardDataPreferences()).cardOverrides).toEqual({ Bolt: 'printing-id' });
    await expect(getCardPreferenceOverride('Bolt')).resolves.toBe('printing-id');
    await expect(getCardPreferenceOverride('bolt')).resolves.toBe('');
  });

  it('returns the latest value after a refresh, not the first load', async () => {
    const { currentCardDataPreferences, refreshCardDataPreferences } = await load();
    hoisted.settings.mockResolvedValueOnce({ pictureUrlTemplates: ['https://a/!name!'] });
    const first = await currentCardDataPreferences();

    hoisted.settings.mockResolvedValueOnce({ pictureUrlTemplates: ['https://b/!name!'] });
    await refreshCardDataPreferences();
    const next = await currentCardDataPreferences();

    expect(next).not.toBe(first);
    expect(next.pictureUrlTemplates).toEqual(['https://b/!name!']);
  });

  it('tells listeners about each refresh until they unsubscribe', async () => {
    const { onCardDataPreferencesRefreshed, refreshCardDataPreferences } = await load();
    hoisted.settings.mockResolvedValue({ pictureUrlTemplates: ['https://a/!name!'] });
    const listener = vi.fn();
    const unsubscribe = onCardDataPreferencesRefreshed(listener);

    const next = await refreshCardDataPreferences();
    unsubscribe();
    await refreshCardDataPreferences();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(next);
  });

  it('retries a failed load on the next read', async () => {
    const { currentCardDataPreferences } = await load();
    hoisted.settings.mockRejectedValueOnce(new Error('blocked'));
    await expect(currentCardDataPreferences()).rejects.toThrow('blocked');

    hoisted.settings.mockResolvedValueOnce({ pictureUrlTemplates: [] });
    await expect(currentCardDataPreferences()).resolves.toMatchObject({ pictureUrlTemplates: [] });
  });
});
