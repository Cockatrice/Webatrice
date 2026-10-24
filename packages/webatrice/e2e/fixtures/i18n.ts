import i18next, { type TOptions } from 'i18next';
import ICU from 'i18next-icu';

import english from '../../src/i18n-default.json';

const i18n = i18next.createInstance();
void i18n.use(ICU).init({
  lng: 'en',
  fallbackLng: 'en',
  initAsync: false,
  resources: { en: { translation: english } },
  interpolation: { escapeValue: false },
});

export function t(key: string, options?: TOptions): string {
  return i18n.t(key, options) as string;
}
