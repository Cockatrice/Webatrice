import { DEFAULT_LANGUAGE, Language } from '@app/types';

export const toBcp47 = (lng: string | undefined): string => (lng ?? '').replace(/_/g, '-');

export const LANGUAGE_STORAGE_KEY = 'i18nextLng';

const LANGUAGES = Object.values(Language);

export function resolveSupportedLanguage(tag: string | null | undefined): Language | undefined {
  if (!tag) {
    return undefined;
  }
  const normalized = tag.trim().replace(/-/g, '_').toLowerCase();
  const exact = LANGUAGES.find((language) => language.toLowerCase() === normalized);
  if (exact) {
    return exact;
  }
  const base = normalized.split('_')[0];
  return LANGUAGES.find((language) => language.toLowerCase().split('_')[0] === base);
}

export const toSupportedLanguage = (tag: string | null | undefined): Language =>
  resolveSupportedLanguage(tag) ?? DEFAULT_LANGUAGE;
