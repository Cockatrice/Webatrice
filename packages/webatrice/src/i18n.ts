import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';

import { Language } from '@app/types';
import { toBcp47 } from '@app/utils';
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

// Re-render a message that failed ICU parse/format from the bundled, validated
// English source, so a malformed *translation* (a Transifex data error, e.g. a
// missing `select` comma or localized ICU keywords) never reaches users as a raw
// `{…}` template. Returns `res` unchanged when there's no usable English fallback
// — including when the failing string IS the English source, which keeps our own
// malformed strings visible rather than masking them. Uses the IntlMessageFormat
// i18next-icu attaches to the instance, so there's no recursion through `t()`.
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
    return new IntlMessageFormat(en, Language['en-US']).format(options);
  } catch {
    return res; // English source also malformed — fall through to the raw string
  }
}

export default i18n;
