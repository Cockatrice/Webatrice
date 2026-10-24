import type { TFunction } from 'i18next';

import {
  banMinutes,
  buildBanUserSchema,
  buildWarnUserSchema,
  type BanUserFormValues,
} from './moderationFormSchemas';

const t = ((key: string) => key) as unknown as TFunction;

const ban = (overrides: Partial<BanUserFormValues> = {}): BanUserFormValues => ({
  byName: true,
  userName: 'alice',
  byIp: true,
  address: '10.0.0.1',
  byClientId: false,
  clientId: '',
  duration: 'temporary',
  days: 0,
  hours: 0,
  minutes: 5,
  reason: '',
  visibleReason: '',
  redact: false,
  ...overrides,
});

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('buildBanUserSchema', () => {
  const schema = buildBanUserSchema(t);

  it('accepts desktop\'s defaults', () => {
    expect(schema.safeParse(ban()).success).toBe(true);
  });

  it('requires at least one ban type', () => {
    expect(messages(schema.safeParse(ban({ byName: false, byIp: false })))).toEqual(['Moderation.ban.errorNoType']);
  });

  it.each([
    ['byName', 'userName', 'Moderation.ban.errorBlankName'],
    ['byIp', 'address', 'Moderation.ban.errorBlankIp'],
    ['byClientId', 'clientId', 'Moderation.ban.errorBlankClientId'],
  ] as const)('requires a value when %s is ticked', (toggle, field, message) => {
    expect(messages(schema.safeParse(ban({ [toggle]: true, [field]: '  ' })))).toContain(message);
  });

  it('rejects durations outside the spin-box ranges', () => {
    expect(schema.safeParse(ban({ hours: 25 })).success).toBe(false);
    expect(schema.safeParse(ban({ minutes: 61 })).success).toBe(false);
  });
});

describe('banMinutes', () => {
  it('is 0 for a permanent ban', () => {
    expect(banMinutes(ban({ duration: 'permanent', days: 3 }))).toBe(0);
  });

  it('adds days, hours and minutes for a temporary ban', () => {
    expect(banMinutes(ban({ days: 1, hours: 2, minutes: 3 }))).toBe(24 * 60 + 2 * 60 + 3);
  });
});

describe('buildWarnUserSchema', () => {
  const schema = buildWarnUserSchema(t);

  it('requires a user name, then a warning', () => {
    expect(messages(schema.safeParse({ userName: ' ', reason: 'Spamming', redact: false })))
      .toEqual(['Moderation.warn.errorBlankName']);
    expect(messages(schema.safeParse({ userName: 'alice', reason: '', redact: false })))
      .toEqual(['Moderation.warn.errorBlankReason']);
  });
});
