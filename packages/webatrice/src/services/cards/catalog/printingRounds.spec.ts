import { printingKey, printingRounds } from './lookup';

describe('printingRounds', () => {
  it('puts each distinct printing in the first request that has no other printing of that name', () => {
    const rounds = printingRounds([
      { name: 'Island', set: 'M21', collectorNumber: '264' },
      { name: 'Opt' },
      { name: 'Island', set: 'm21', collectorNumber: '264' },
      { name: 'Island', set: 'DMU' },
      { name: 'Island' },
    ]);
    expect(rounds).toEqual([
      [{ name: 'Island', set: 'M21', collectorNumber: '264' }, { name: 'Opt' }],
      [{ name: 'Island', set: 'DMU' }],
      [{ name: 'Island' }],
    ]);
  });

  it('keys a printing by name, set (any case), number and id', () => {
    expect(printingKey({ name: 'Opt', set: 'XLN' })).toBe(printingKey({ name: 'Opt', set: 'xln' }));
    expect(printingKey({ name: 'Opt', set: 'XLN' })).not.toBe(printingKey({ name: 'Opt', set: 'XLN', collectorNumber: '65' }));
  });
});
