import { buildChangePasswordFormSchema, type ChangePasswordFormValues } from './changePasswordFormSchema';

const t = ((key: string, opts?: Record<string, unknown>) =>
  opts && 'count' in opts ? `${key}:${opts.count}` : key) as any;

const values = (overrides: Partial<ChangePasswordFormValues> = {}): ChangePasswordFormValues => ({
  oldPassword: 'oldpassword',
  newPassword: 'newpassword',
  newPasswordConfirm: 'newpassword',
  ...overrides,
});

const firstIssue = (overrides: Partial<ChangePasswordFormValues>) =>
  buildChangePasswordFormSchema(t).safeParse(values(overrides)).error?.issues[0];

describe('buildChangePasswordFormSchema', () => {
  it('accepts a valid change', () => {
    expect(buildChangePasswordFormSchema(t).safeParse(values()).success).toBe(true);
  });

  it('requires the old password', () => {
    expect(firstIssue({ oldPassword: '' })).toMatchObject({ path: ['oldPassword'], message: 'Common.validation.required' });
  });

  it('rejects new passwords shorter than desktop’s 8-character minimum', () => {
    expect(firstIssue({ newPassword: 'short', newPasswordConfirm: 'short' }))
      .toMatchObject({ path: ['newPassword'], message: 'Common.validation.minChars:8' });
  });

  it('rejects a confirmation that does not match', () => {
    expect(firstIssue({ newPasswordConfirm: 'different' }))
      .toMatchObject({ path: ['newPasswordConfirm'], message: 'Common.validation.passwordsMustMatch' });
  });
});
