import type { TFunction } from 'i18next';

import { buildActivateUserSchema, buildGrantReplaySchema, buildShutdownSchema } from './administrationSchemas';

const t = ((key: string) => key) as unknown as TFunction;

describe('buildShutdownSchema', () => {
  it.each([['0'], ['5'], ['999']])('accepts %s minutes', (minutes) => {
    expect(buildShutdownSchema(t).safeParse({ reason: '', minutes }).success).toBe(true);
  });

  it.each([['1000'], ['-1'], ['2.5'], ['']])('rejects %s minutes', (minutes) => {
    expect(buildShutdownSchema(t).safeParse({ reason: '', minutes }).success).toBe(false);
  });

  it('caps the reason at desktop MAX_TEXT_LENGTH (4095)', () => {
    expect(buildShutdownSchema(t).safeParse({ reason: 'x'.repeat(4095), minutes: '5' }).success).toBe(true);
    expect(buildShutdownSchema(t).safeParse({ reason: 'x'.repeat(4096), minutes: '5' }).success).toBe(false);
  });
});

describe('buildGrantReplaySchema', () => {
  it('accepts a non-negative 32-bit replay id only', () => {
    const schema = buildGrantReplaySchema(t);
    expect(schema.safeParse({ replayId: '2147483647' }).success).toBe(true);
    expect(schema.safeParse({ replayId: '2147483648' }).success).toBe(false);
    expect(schema.safeParse({ replayId: '12a' }).success).toBe(false);
  });
});

describe('buildActivateUserSchema', () => {
  it('trims the user name and requires one', () => {
    const schema = buildActivateUserSchema(t);
    expect(schema.parse({ userName: ' bob ' })).toEqual({ userName: 'bob' });
    expect(schema.safeParse({ userName: '   ' }).success).toBe(false);
  });
});
