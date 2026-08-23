import { toBcp47 } from './locale';

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
