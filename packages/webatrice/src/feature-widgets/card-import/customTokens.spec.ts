import type { TFunction } from 'i18next';

import {
  applyTokenData,
  buildAddTokenSchema,
  buildTokenDataSchema,
  createCustomToken,
  readTokenData,
} from './customTokens';

const t = ((key: string) => key) as unknown as TFunction;

describe('customTokens', () => {
  it('creates a TK token typed Token, like DlgEditTokens::actAddToken', () => {
    expect(createCustomToken('Spirit')).toEqual({
      name: { value: 'Spirit' },
      text: { value: '' },
      prop: { value: { type: { value: 'Token' }, maintype: { value: 'Token' } } },
      set: { value: 'TK' },
      token: { value: '1' },
    });
  });

  it('round-trips color, P/T and annotation through the token record', () => {
    const token = applyTokenData(createCustomToken('Spirit'), { color: 'w', pt: '1/1', annotation: 'Flying' });
    expect(token.prop?.value.colors).toEqual({ value: 'W' });
    expect(token.prop?.value.type).toEqual({ value: 'Token' });
    expect(readTokenData(token)).toEqual({ color: 'w', pt: '1/1', annotation: 'Flying' });
  });

  it('drops colors and P/T when cleared (colorless, no P/T)', () => {
    const colored = applyTokenData(createCustomToken('X'), { color: 'm', pt: '2/2', annotation: '' });
    const cleared = applyTokenData(colored, { color: 'c', pt: '', annotation: '' });
    expect(cleared.prop?.value.colors).toBeUndefined();
    expect(cleared.prop?.value.pt).toBeUndefined();
    expect(readTokenData(cleared).color).toBe('c');
  });

  it('reads unknown color strings as colorless', () => {
    expect(readTokenData({ name: { value: 'X' }, prop: { value: { colors: { value: 'Q' } } } }).color).toBe('c');
  });

  it('validates the new token name and field lengths', () => {
    expect(buildAddTokenSchema(t).safeParse({ name: '  ' }).success).toBe(false);
    expect(buildAddTokenSchema(t).safeParse({ name: 'x'.repeat(256) }).success).toBe(false);
    expect(buildAddTokenSchema(t).safeParse({ name: 'Spirit' }).success).toBe(true);
    expect(buildTokenDataSchema(t).safeParse({ color: 'w', pt: 'x'.repeat(256), annotation: '' }).success).toBe(false);
  });
});
