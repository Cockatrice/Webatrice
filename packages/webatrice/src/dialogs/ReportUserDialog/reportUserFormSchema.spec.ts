import type { TFunction } from 'i18next';

import { buildReportUserFormSchema } from './reportUserFormSchema';

const t = ((key: string) => key) as unknown as TFunction;
const schema = buildReportUserFormSchema(t);

describe('buildReportUserFormSchema', () => {
  it('accepts a category, a description and an empty game id', () => {
    expect(schema.safeParse({ category: 'spam', gameId: '', description: 'ads' }).success).toBe(true);
  });

  it('requires a non-blank description', () => {
    const result = schema.safeParse({ category: 'spam', gameId: '', description: '   ' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('ReportUserDialog.validation.description');
  });

  it('only accepts categories Servatrice whitelists', () => {
    expect(schema.safeParse({ category: 'rudeness', gameId: '', description: 'x' }).success).toBe(false);
  });

  it.each(['12', ' 7 '])('accepts the positive game number %j', (gameId) => {
    expect(schema.safeParse({ category: 'other', gameId, description: 'x' }).success).toBe(true);
  });

  it.each(['0', 'abc', '-3', '1.5'])('rejects the game number %j', (gameId) => {
    const result = schema.safeParse({ category: 'other', gameId, description: 'x' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('ReportUserDialog.validation.gameId');
  });
});
