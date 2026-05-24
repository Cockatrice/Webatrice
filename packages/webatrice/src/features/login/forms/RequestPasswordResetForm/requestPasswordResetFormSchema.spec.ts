import {
  buildRequestPasswordResetFormSchema,
  type RequestPasswordResetFormValues,
} from './requestPasswordResetFormSchema';

const t = ((key: string) => key) as any;
const host = { id: 1, name: 'h', host: 'h', port: '4747' } as any;

const baseValues = (
  overrides: Partial<RequestPasswordResetFormValues> = {},
): RequestPasswordResetFormValues =>
  ({
    userName: 'alice',
    email: '',
    selectedHost: host,
    ...overrides,
  }) as RequestPasswordResetFormValues;

describe('buildRequestPasswordResetFormSchema — not MFA', () => {
  const schema = buildRequestPasswordResetFormSchema(t, false);

  test('accepts a valid payload without email', () => {
    expect(schema.safeParse(baseValues()).success).toBe(true);
  });

  test('rejects an empty userName', () => {
    expect(schema.safeParse(baseValues({ userName: '' })).success).toBe(false);
  });

  test('rejects a missing selectedHost', () => {
    expect(schema.safeParse(baseValues({ selectedHost: undefined as any })).success).toBe(false);
  });

  test('allows an empty email when not MFA', () => {
    expect(schema.safeParse(baseValues({ email: '' })).success).toBe(true);
  });
});

describe('buildRequestPasswordResetFormSchema — MFA', () => {
  const schema = buildRequestPasswordResetFormSchema(t, true);

  test('rejects an empty email when MFA is enabled', () => {
    expect(schema.safeParse(baseValues({ email: '' })).success).toBe(false);
  });

  test('accepts a populated email when MFA is enabled', () => {
    expect(schema.safeParse(baseValues({ email: 'a@b.com' })).success).toBe(true);
  });
});
