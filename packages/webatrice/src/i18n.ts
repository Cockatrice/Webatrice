import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';

import { Language } from '@app/types';
import { toBcp47 } from '@app/utils';
import I18nBackend from './i18n-backend';

// Bundle default translation with application
import translation from './i18n-default.json';

i18n
  .use(ICU)
  .use(I18nBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    fallbackLng: Language['en-US'],
    resources: {
      [Language['en-US']]: { translation },
    },
    partialBundledLanguages: true,
    i18nFormat: {
      // Locale codes are Cockatrice/Transifex underscore style (e.g. `pt_BR`),
      // but IntlMessageFormat needs BCP-47 hyphens (`pt-BR`) or it throws
      // `RangeError: Invalid language tag`. Normalize only at this boundary.
      parseLngForICU: toBcp47,
      parseErrorHandler: (err: unknown, key: string, res: string) => {
        if (import.meta.env.DEV) {
          console.error(`[i18n-icu] failed to format "${key}":`, err);
        }
        return res;
      },
    },

    interpolation: {
      // not needed for react as it escapes by default
      escapeValue: false,
    }
  });

export default i18n;
