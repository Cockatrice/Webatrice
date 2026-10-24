import { create } from '@bufbuild/protobuf';

import { Response_WarnListSchema } from '@cockatrice/sockatrice/generated';

import { toWarningOptions } from './warningOptions';

describe('toWarningOptions', () => {
  it('is empty before the warn list arrives', () => {
    expect(toWarningOptions(undefined)).toEqual([]);
  });

  it('pairs each reason with its starting level, defaulting to 1 (3.0 servers send none)', () => {
    const warnList = create(Response_WarnListSchema, { warning: [' Spamming ', 'Cheating', 'Flaming'], warningIl: [1, 2] });
    expect(toWarningOptions(warnList)).toEqual([
      { warning: 'Spamming', startingIl: 1 },
      { warning: 'Cheating', startingIl: 2 },
      { warning: 'Flaming', startingIl: 1 },
    ]);
  });
});
