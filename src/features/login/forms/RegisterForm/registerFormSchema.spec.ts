import { buildRegisterFormSchema, type RegisterFormValues } from './registerFormSchema';

// Identity-ish translator: returns the key (plus count for interpolation cases)
const t = ((key: string, opts?: Record<string, unknown>) =>
  opts && 'count' in opts ? `${key}:${opts.count}` : key) as any;

const host = { id: 1, name: 'h', host: 'h', port: '4747' } as any;

const baseValues = (overrides: Partial<RegisterFormValues> = {}): RegisterFormValues =>
  ({
    userName: 'alice',
    password: 'password1',
    passwordConfirm: 'password1',
    email: '',
    emailConfirm: '',
    realName: '',
    country: '',
    selectedHost: host,
    ...overrides,
  }) as RegisterFormValues;

describe('buildRegisterFormSchema — email not required', () => {
  const schema = buildRegisterFormSchema(t, false);

  test('accepts a valid payload', () => {
    expect(schema.safeParse(baseValues()).success).toBe(true);
  });

  test('rejects an empty userName', () => {
    const result = schema.safeParse(baseValues({ userName: '' }));
    expect(result.success).toBe(false);
  });

  test('rejects a password shorter than 8 chars', () => {
    const result = schema.safeParse(baseValues({ password: 'short', passwordConfirm: 'short' }));
    expect(result.success).toBe(false);
  });

  test('rejects mismatched password confirmation', () => {
    const result = schema.safeParse(baseValues({ passwordConfirm: 'different1' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('passwordConfirm'))).toBe(true);
    }
  });

  test('rejects a missing selectedHost', () => {
    const result = schema.safeParse(baseValues({ selectedHost: undefined as any }));
    expect(result.success).toBe(false);
  });

  test('allows empty email when email is not required', () => {
    expect(schema.safeParse(baseValues({ email: '', emailConfirm: '' })).success).toBe(true);
  });
});

describe('buildRegisterFormSchema — email required', () => {
  const schema = buildRegisterFormSchema(t, true);

  test('rejects an empty email when required', () => {
    const result = schema.safeParse(baseValues({ email: '', emailConfirm: '' }));
    expect(result.success).toBe(false);
  });

  test('rejects mismatched email confirmation', () => {
    const result = schema.safeParse(
      baseValues({ email: 'a@b.com', emailConfirm: 'c@d.com' }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('emailConfirm'))).toBe(true);
    }
  });

  test('accepts matching emails', () => {
    expect(
      schema.safeParse(baseValues({ email: 'a@b.com', emailConfirm: 'a@b.com' })).success,
    ).toBe(true);
  });
});
