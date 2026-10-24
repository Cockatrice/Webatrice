import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_LANGUAGE, Language } from '@app/types';
import { resolveSupportedLanguage, toBcp47, toSupportedLanguage } from './locale';

describe('toBcp47', () => {
  test('converts underscore locale codes to BCP-47 hyphens', () => {
    expect(toBcp47('pt_BR')).toBe('pt-BR');
    expect(toBcp47('en_US')).toBe('en-US');
  });

  test('leaves already-hyphenated and single-segment codes unchanged', () => {
    expect(toBcp47('en-US')).toBe('en-US');
    expect(toBcp47('fr')).toBe('fr');
    expect(toBcp47('nl')).toBe('nl');
  });

  test('coerces undefined to an empty string', () => {
    expect(toBcp47(undefined)).toBe('');
  });
});

describe('resolveSupportedLanguage', () => {
  test('maps browser BCP-47 tags onto the underscore catalogue codes', () => {
    expect(resolveSupportedLanguage('en-US')).toBe(Language.en_US);
    expect(resolveSupportedLanguage('pt-BR')).toBe(Language.pt_BR);
    expect(resolveSupportedLanguage('PT-br')).toBe(Language.pt_BR);
  });

  test('accepts the catalogue codes themselves', () => {
    for (const language of Object.values(Language)) {
      expect(resolveSupportedLanguage(language)).toBe(language);
    }
  });

  test('falls back to the base language when the region has no catalogue', () => {
    expect(resolveSupportedLanguage('en')).toBe(Language.en_US);
    expect(resolveSupportedLanguage('en-GB')).toBe(Language.en_US);
    expect(resolveSupportedLanguage('pt-PT')).toBe(Language.pt_BR);
    expect(resolveSupportedLanguage('de-AT')).toBe(Language.de);
    expect(resolveSupportedLanguage('yue-Hant-HK')).toBe(Language.yue);
  });

  test('returns undefined for languages without a catalogue', () => {
    expect(resolveSupportedLanguage('ja-JP')).toBeUndefined();
    expect(resolveSupportedLanguage('')).toBeUndefined();
    expect(resolveSupportedLanguage(undefined)).toBeUndefined();
  });

  test('toSupportedLanguage falls back to the bundled English catalogue', () => {
    expect(toSupportedLanguage('ja')).toBe(DEFAULT_LANGUAGE);
    expect(toSupportedLanguage('fr-CA')).toBe(Language.fr);
  });
});

describe('Language', () => {
  test('lists exactly the catalogues shipped in public/locales', () => {
    const localesDir = path.resolve(__dirname, '../../public/locales');
    const shipped = fs.readdirSync(localesDir).filter((entry) =>
      fs.existsSync(path.join(localesDir, entry, 'translation.json')),
    );
    expect([...Object.values(Language)].sort()).toEqual([...shipped].sort());
  });
});
