import {
  buildAccountActivationFormSchema,
  type AccountActivationFormValues,
} from './accountActivationFormSchema';

const t = ((key: string) => key) as any;

describe('buildAccountActivationFormSchema', () => {
  const schema = buildAccountActivationFormSchema(t);

  test('accepts a populated token', () => {
    const result = schema.safeParse({ token: 'abc123' } as AccountActivationFormValues);
    expect(result.success).toBe(true);
  });

  test('rejects an empty token', () => {
    const result = schema.safeParse({ token: '' } as AccountActivationFormValues);
    expect(result.success).toBe(false);
  });

  test('rejects a whitespace-only token', () => {
    const result = schema.safeParse({ token: '   ' } as AccountActivationFormValues);
    expect(result.success).toBe(false);
  });

  test('trims surrounding whitespace from the token', () => {
    const result = schema.safeParse({ token: '  abc  ' } as AccountActivationFormValues);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token).toBe('abc');
    }
  });
});
