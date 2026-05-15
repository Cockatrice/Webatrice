import {
  buildResetPasswordFormSchema,
  type ResetPasswordFormValues,
} from './resetPasswordFormSchema';

const t = ((key: string, opts?: Record<string, unknown>) =>
  opts && 'count' in opts ? `${key}:${opts.count}` : key) as any;
const host = { id: 1, name: 'h', host: 'h', port: '4747' } as any;

const baseValues = (overrides: Partial<ResetPasswordFormValues> = {}): ResetPasswordFormValues =>
  ({
    userName: 'alice',
    token: 'token123',
    newPassword: 'password1',
    passwordAgain: 'password1',
    selectedHost: host,
    ...overrides,
  }) as ResetPasswordFormValues;

describe('buildResetPasswordFormSchema', () => {
  const schema = buildResetPasswordFormSchema(t);

  test('accepts a valid payload', () => {
    expect(schema.safeParse(baseValues()).success).toBe(true);
  });

  test('rejects an empty userName', () => {
    expect(schema.safeParse(baseValues({ userName: '' })).success).toBe(false);
  });

  test('rejects an empty token', () => {
    expect(schema.safeParse(baseValues({ token: '' })).success).toBe(false);
  });

  test('rejects a new password shorter than 8 chars', () => {
    expect(
      schema.safeParse(baseValues({ newPassword: 'short', passwordAgain: 'short' })).success,
    ).toBe(false);
  });

  test('rejects mismatched password confirmation', () => {
    const result = schema.safeParse(baseValues({ passwordAgain: 'different1' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('passwordAgain'))).toBe(true);
    }
  });

  test('rejects a missing selectedHost', () => {
    expect(schema.safeParse(baseValues({ selectedHost: undefined as any })).success).toBe(false);
  });
});
