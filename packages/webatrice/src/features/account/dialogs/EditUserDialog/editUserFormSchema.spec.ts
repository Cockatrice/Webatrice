import { buildEditUserFormSchema, needsPasswordCheck, type EditUserFormValues } from './editUserFormSchema';

const t = ((key: string, opts?: Record<string, unknown>) =>
  opts && 'count' in opts ? `${key}:${opts.count}` : key) as any;

const values = (overrides: Partial<EditUserFormValues> = {}): EditUserFormValues => ({
  email: 'old@example.com',
  country: 'US',
  realName: 'Alice',
  passwordCheck: '',
  ...overrides,
});

describe('needsPasswordCheck', () => {
  it('asks for the password only when a hash-capable server sees the email change', () => {
    const hashed = { originalEmail: 'old@example.com', supportsPasswordHash: true };
    expect(needsPasswordCheck('old@example.com', hashed)).toBe(false);
    expect(needsPasswordCheck('  old@example.com ', hashed)).toBe(false);
    expect(needsPasswordCheck('new@example.com', hashed)).toBe(true);
    expect(needsPasswordCheck('new@example.com', { ...hashed, supportsPasswordHash: false })).toBe(false);
  });

  it('treats an unknown capability like a hash-capable server', () => {
    expect(needsPasswordCheck('new@example.com', { originalEmail: 'old@example.com', supportsPasswordHash: undefined }))
      .toBe(true);
  });
});

describe('buildEditUserFormSchema', () => {
  const hashedSchema = buildEditUserFormSchema(t, { originalEmail: 'old@example.com', supportsPasswordHash: true });

  it('accepts an unchanged email without a password check', () => {
    expect(hashedSchema.safeParse(values()).success).toBe(true);
  });

  it('requires the password check when the email changes on a hash-capable server', () => {
    const result = hashedSchema.safeParse(values({ email: 'new@example.com' }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ['passwordCheck'], message: 'Common.validation.required' });
    expect(hashedSchema.safeParse(values({ email: 'new@example.com', passwordCheck: 'pw' })).success).toBe(true);
  });

  it('never requires the password check on servers without password hashing', () => {
    const schema = buildEditUserFormSchema(t, { originalEmail: 'old@example.com', supportsPasswordHash: false });
    expect(schema.safeParse(values({ email: 'new@example.com' })).success).toBe(true);
  });

  it('rejects fields longer than Servatrice MAX_NAME_LENGTH', () => {
    const result = hashedSchema.safeParse(values({ realName: 'x'.repeat(256) }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('AccountDialogs.validation.maxChars:255');
  });
});
