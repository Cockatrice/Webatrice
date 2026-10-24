import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LANGUAGE, Language } from '@app/types';
import { resolveSupportedLanguage, toBcp47 } from '@app/utils';
import I18nBackend from './i18n-backend';

// Bundle default translation with application
import translation from './i18n-default.json';

type IntlMessageFormatCtor = new (message: string, locale: string) => { format(opts?: unknown): string };

i18n
  .use(ICU)
  .use(I18nBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: Object.values(Language),
    resources: {
      [DEFAULT_LANGUAGE]: { translation },
    },
    partialBundledLanguages: true,
    detection: {
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      caches: [],
      convertDetectedLanguage: (lng: string) => resolveSupportedLanguage(lng) ?? lng,
    },
    i18nFormat: {
      parseLngForICU: toBcp47,
      parseErrorHandler: (err: unknown, key: string, res: string, options?: unknown) => {
        if (import.meta.env.DEV) {
          console.error(`[i18n-icu] failed to format "${key}":`, err);
        }
        return formatWithEnglishFallback(key, res, options);
      },
    },

    interpolation: {
      // not needed for react as it escapes by default
      escapeValue: false,
    }
  });

function formatWithEnglishFallback(key: string, res: string, options?: unknown): string {
  const en = key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    translation,
  );
  if (typeof en !== 'string' || en === res) {
    return res;
  }
  const IntlMessageFormat = (i18n as unknown as { IntlMessageFormat?: IntlMessageFormatCtor }).IntlMessageFormat;
  if (!IntlMessageFormat) {
    return res;
  }
  try {
    return new IntlMessageFormat(en, toBcp47(DEFAULT_LANGUAGE)).format(options);
  } catch {
    return res;
  }
}

export default i18n;
