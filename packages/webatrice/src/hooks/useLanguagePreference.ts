import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { Language } from '@app/types';
import { LANGUAGE_STORAGE_KEY, resolveSupportedLanguage, toSupportedLanguage } from '@app/utils';
import { getSettings, usePreference, useSettings } from './useSettings';
import { LoadingState } from './useSharedStore';

function mirrorForBoot(language: Language | undefined): void {
  try {
    if (language) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } else {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    }
  } catch {
    // Storage blocked: the preference still applies once settings load.
  }
}

export interface LanguagePreference {
  current: Language;
  choose: (next: Language | '') => Promise<void>;
}

export function useLanguagePreference(): LanguagePreference {
  const { i18n } = useTranslation();
  const { update } = useSettings();

  const choose = useCallback(async (next: Language | '') => {
    await getSettings();
    await update({ language: next });
  }, [update]);

  return {
    current: toSupportedLanguage(i18n.resolvedLanguage ?? i18n.language),
    choose,
  };
}

export function useApplyLanguagePreference(): void {
  const { i18n } = useTranslation();
  const ready = useSettings().status === LoadingState.READY;
  const preference = usePreference('language');
  const applied = useRef<Language | undefined | null>(null);
  const version = useRef(0);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const chosen = resolveSupportedLanguage(preference);
    const current = ++version.current;
    const previous = applied.current;
    applied.current = chosen;
    mirrorForBoot(chosen);

    if (chosen) {
      void i18n.loadLanguages(chosen).then(() => {
        if (current === version.current) {
          return i18n.changeLanguage(chosen);
        }
      });
    } else if (previous) {
      void i18n.changeLanguage();
    }
    return () => {
      version.current = current + 1;
    };
  }, [ready, preference, i18n]);
}
