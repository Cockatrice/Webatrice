import { renderHook, act, waitFor } from '@testing-library/react';

const mockSave = vi.fn();
let storedSetting: any = null;

vi.mock('@app/services', () => ({
  SettingDTO: class MockSettingDTO {
    user: string;
    autoConnect = false;
    constructor(user: string) {
      this.user = user;
    }
    save = mockSave;
    static get = vi.fn(() => Promise.resolve(storedSetting));
  },
  migrateSetting: vi.fn((row: any) => {
    row.migrated = true;
    if ((row.version ?? 0) < 5) {
      row.themeName = 'midnight';
    }
    row.version = 5;
    return row;
  }),
}));

vi.mock('@app/types', () => ({
  APP_USER: '*app',
  PREFERENCE_DEFAULTS: { playToStack: true, soundEnabled: false, messageMacros: [], themeName: 'graphite' },
}));

// Each spec resets module state so the shared store starts fresh.
let useSettingsModule: typeof import('./useSettings');
let LoadingState: typeof import('./useSharedStore').LoadingState;

beforeEach(async () => {
  vi.resetModules();
  storedSetting = null;
  mockSave.mockClear();
  useSettingsModule = await import('./useSettings');
  ({ LoadingState } = await import('./useSharedStore'));
});

describe('useSettings', () => {
  test('starts in loading state, then resolves to the stored setting', async () => {
    storedSetting = { user: '*app', autoConnect: true, save: mockSave };

    const { result } = renderHook(() => useSettingsModule.useSettings());

    expect(result.current.status).toBe(LoadingState.LOADING);

    await waitFor(() => {
      expect(result.current.status).toBe(LoadingState.READY);
    });

    if (result.current.status === LoadingState.READY) {
      expect(result.current.value.autoConnect).toBe(true);
    }
  });

  test('creates and saves a new SettingDTO when none exists', async () => {
    storedSetting = null;

    const { result } = renderHook(() => useSettingsModule.useSettings());

    await waitFor(() => {
      expect(result.current.status).toBe(LoadingState.READY);
    });

    if (result.current.status === LoadingState.READY) {
      expect(result.current.value.autoConnect).toBe(false);
    }
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  test('gives a first visit the default theme, not the one migrations keep for existing users', async () => {
    storedSetting = null;

    const { result } = renderHook(() => useSettingsModule.useSettings());

    await waitFor(() => {
      expect(result.current.status).toBe(LoadingState.READY);
    });

    if (result.current.status === LoadingState.READY) {
      expect(result.current.value.themeName).toBe('graphite');
    }
  });

  test('keeps the migrated theme for an existing row', async () => {
    storedSetting = { user: '*app', version: 4, save: mockSave };

    const { result } = renderHook(() => useSettingsModule.useSettings());

    await waitFor(() => {
      expect(result.current.status).toBe(LoadingState.READY);
    });

    if (result.current.status === LoadingState.READY) {
      expect(result.current.value.themeName).toBe('midnight');
    }
  });

  test('update() persists the patch and re-renders with a new snapshot', async () => {
    storedSetting = { user: '*app', autoConnect: false, save: mockSave };

    const { result } = renderHook(() => useSettingsModule.useSettings());

    await waitFor(() => {
      expect(result.current.status).toBe(LoadingState.READY);
    });

    mockSave.mockClear();
    const before = result.current;

    await act(async () => {
      await result.current.update({ autoConnect: true });
    });

    expect(result.current).not.toBe(before);
    if (result.current.status === LoadingState.READY) {
      expect(result.current.value.autoConnect).toBe(true);
    }
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  test('does not re-save on the initial load when setting already exists', async () => {
    storedSetting = { user: '*app', autoConnect: true, save: mockSave };

    renderHook(() => useSettingsModule.useSettings());

    await waitFor(() => {
      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  test('migrates the stored row on load', async () => {
    storedSetting = { user: '*app', autoConnect: true, save: mockSave };

    const { result } = renderHook(() => useSettingsModule.useSettings());

    await waitFor(() => {
      expect(result.current.status).toBe(LoadingState.READY);
    });
    expect((result.current.value as any).migrated).toBe(true);
  });
});

describe('usePreference / usePreferences', () => {
  test('return the desktop defaults until the row has loaded, then the stored values', async () => {
    storedSetting = { user: '*app', playToStack: false, soundEnabled: true, messageMacros: ['gg'], save: mockSave };

    const { result } = renderHook(() => ({
      playToStack: useSettingsModule.usePreference('playToStack'),
      macros: useSettingsModule.useMessageMacros(),
    }));

    expect(result.current.playToStack).toBe(true);
    expect(result.current.macros).toEqual([]);

    await waitFor(() => {
      expect(result.current.playToStack).toBe(false);
    });
    expect(result.current.macros).toEqual(['gg']);
  });

  test('re-render when a preference is updated', async () => {
    storedSetting = { user: '*app', soundEnabled: false, save: mockSave };

    const { result } = renderHook(() => ({
      settings: useSettingsModule.useSettings(),
      soundEnabled: useSettingsModule.usePreference('soundEnabled'),
    }));
    await waitFor(() => {
      expect(result.current.settings.status).toBe(LoadingState.READY);
    });

    await act(async () => {
      await result.current.settings.update({ soundEnabled: true });
    });

    expect(result.current.soundEnabled).toBe(true);
  });
  test('usePreference re-renders only when its own preference changes', async () => {
    storedSetting = { user: '*app', playToStack: true, soundEnabled: false, save: mockSave };
    let renders = 0;
    renderHook(() => {
      renders++;
      return useSettingsModule.usePreference('playToStack');
    });
    await act(async () => {
      await useSettingsModule.getSettings();
    });
    const settled = renders;

    const { result } = renderHook(() => useSettingsModule.useSettings());
    await act(async () => {
      await result.current.update({ soundEnabled: true });
    });
    expect(renders).toBe(settled);

    await act(async () => {
      await result.current.update({ playToStack: false });
    });
    expect(renders).toBe(settled + 1);
  });
});

describe('getPreferencesSnapshot', () => {
  test('returns the defaults before load and the live row afterwards', async () => {
    expect(useSettingsModule.getPreferencesSnapshot().soundEnabled).toBe(false);

    storedSetting = { user: '*app', soundEnabled: true, save: mockSave };
    await useSettingsModule.getSettings();

    expect(useSettingsModule.getPreferencesSnapshot().soundEnabled).toBe(true);
  });
});
