import { act, renderHook, waitFor } from '@testing-library/react';
import { createInstance, type ReadCallback } from 'i18next';

import { Language, PREFERENCE_DEFAULTS } from '@app/types';
import { makeSettingsHook } from './__mocks__/useSettings';
import { LANGUAGE_STORAGE_KEY } from '@app/utils';
import { useApplyLanguagePreference, useLanguagePreference } from './useLanguagePreference';
import { getSettings, usePreferences, useSettings } from './useSettings';
import { LoadingState } from './useSharedStore';

vi.mock('./useSettings');

const mockI18n = {
  language: 'en_US',
  resolvedLanguage: 'en_US' as string | undefined,
  changeLanguage: vi.fn(),
  loadLanguages: vi.fn(),
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: mockI18n }),
}));

const preferLanguage = (language: string) => {
  vi.mocked(usePreferences).mockReturnValue({ ...PREFERENCE_DEFAULTS, language });
};

describe('useApplyLanguagePreference', () => {
  beforeEach(() => {
    mockI18n.language = 'en_US';
    mockI18n.loadLanguages.mockResolvedValue(undefined);
    mockI18n.changeLanguage.mockResolvedValue(undefined);
    localStorage.clear();
    vi.mocked(useSettings).mockReturnValue(makeSettingsHook());
  });

  test('waits for the settings row before touching the language', () => {
    vi.mocked(useSettings).mockReturnValue(makeSettingsHook({ status: LoadingState.LOADING }));
    preferLanguage('fr');

    renderHook(() => useApplyLanguagePreference());

    expect(mockI18n.changeLanguage).not.toHaveBeenCalled();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  test('switches to the stored language and mirrors it for the next boot', async () => {
    preferLanguage('fr');

    renderHook(() => useApplyLanguagePreference());

    await waitFor(() => expect(mockI18n.changeLanguage).toHaveBeenCalledWith(Language.fr));
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe(Language.fr);
  });

  test('switches live when the preference changes', async () => {
    preferLanguage('fr');
    const { rerender } = renderHook(() => useApplyLanguagePreference());
    mockI18n.language = Language.fr;

    preferLanguage('pt_BR');
    rerender();

    await waitFor(() => expect(mockI18n.changeLanguage).toHaveBeenLastCalledWith(Language.pt_BR));
  });

  test.each(['en_US', 'de', ''])('supersedes a pending catalogue load with %s', async (next) => {
    let finishFrench: () => void = () => {};
    mockI18n.loadLanguages.mockImplementation((language: string) => language === 'fr'
      ? new Promise<void>((resolve) => {
        finishFrench = resolve;
      })
      : Promise.resolve());
    mockI18n.changeLanguage.mockImplementation((language?: string) => {
      mockI18n.language = language ?? 'en_US';
      return Promise.resolve();
    });
    preferLanguage('fr');
    const { rerender } = renderHook(() => useApplyLanguagePreference());
    preferLanguage(next);
    rerender();
    await act(async () => {
      finishFrench();
    });

    expect(mockI18n.language).toBe(next || 'en_US');
    expect(mockI18n.changeLanguage).not.toHaveBeenCalledWith('fr');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe(next || null);
  });

  test('does not apply a catalogue after unmount', async () => {
    let finish: () => void = () => {};
    mockI18n.loadLanguages.mockReturnValue(new Promise<void>((resolve) => {
      finish = resolve;
    }));
    preferLanguage('fr');
    const { unmount } = renderHook(() => useApplyLanguagePreference());
    unmount();
    await act(async () => {
      finish();
    });
    expect(mockI18n.changeLanguage).not.toHaveBeenCalled();
  });

  test.each([['fr', 'en_US'], ['fr', 'de', 'fr', 'en_US']])(
    'keeps the latest preference with a real delayed i18next backend (%j)',
    async (...choices) => {
      const reads = new Map<string, ReadCallback>();
      const instance = createInstance();
      instance.use({
        type: 'backend',
        init: () => {},
        read: (language: string, _namespace: string, callback: ReadCallback) => {
          reads.set(language, callback);
        },
      });
      await instance.init({
        lng: 'en_US', fallbackLng: 'en_US', supportedLngs: ['en_US', 'fr', 'de'],
        resources: { en_US: { translation: { greeting: 'Hello' } } }, partialBundledLanguages: true,
      });
      instance.on('languageChanged', (language) => {
        mockI18n.language = language;
      });
      mockI18n.loadLanguages.mockImplementation(instance.loadLanguages.bind(instance));
      mockI18n.changeLanguage.mockImplementation(instance.changeLanguage.bind(instance));
      preferLanguage('en_US');
      const { rerender } = renderHook(() => useApplyLanguagePreference());
      for (const choice of choices) {
        preferLanguage(choice);
        await act(async () => {
          rerender();
        });
      }
      await act(async () => {
        for (const callback of reads.values()) {
          callback(null, { greeting: 'Translated' });
        }
      });
      expect(instance.language).toBe('en_US');
      expect(instance.t('greeting')).toBe('Hello');
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en_US');
    },
  );

  test('re-detects from the browser when the choice is cleared', () => {
    preferLanguage('de');
    const { rerender } = renderHook(() => useApplyLanguagePreference());

    preferLanguage('');
    rerender();

    expect(mockI18n.changeLanguage).toHaveBeenLastCalledWith();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  test('leaves the detected language alone when following the browser from the start', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en-US');
    preferLanguage('');

    renderHook(() => useApplyLanguagePreference());

    expect(mockI18n.changeLanguage).not.toHaveBeenCalled();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });
});

describe('useLanguagePreference', () => {
  test('reports the active catalogue, normalising a BCP-47 tag', () => {
    mockI18n.resolvedLanguage = 'pt-BR';

    const { result } = renderHook(() => useLanguagePreference());

    expect(result.current.current).toBe(Language.pt_BR);
    mockI18n.resolvedLanguage = 'en_US';
  });

  test('persists a choice once the settings row has loaded', async () => {
    const hook = makeSettingsHook();
    vi.mocked(useSettings).mockReturnValue(hook);

    const { result } = renderHook(() => useLanguagePreference());
    await act(() => result.current.choose(Language.ru));

    expect(getSettings).toHaveBeenCalled();
    expect(hook.update).toHaveBeenCalledWith({ language: Language.ru });
  });
});
