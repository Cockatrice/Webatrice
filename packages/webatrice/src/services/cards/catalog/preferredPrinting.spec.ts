import { preferredPrinting } from './preferredPrinting';

const first = { scryfallId: 'first', set: 'A' };
const pinned = { scryfallId: 'pinned', set: 'B' };
const printings = [first, pinned];

it('selects the pinned printing without changing the available choices', () => {
  expect(preferredPrinting({ printings, pinnedPrintingId: 'pinned' })).toBe(pinned);
  expect(printings).toEqual([first, pinned]);
});

it('returns no printing for a stale pin and the first printing without a pin', () => {
  expect(preferredPrinting({ printings, pinnedPrintingId: 'missing' })).toBeUndefined();
  expect(preferredPrinting({ printings })).toBe(first);
  expect(preferredPrinting({ printings: [], pinnedPrintingId: 'missing' })).toBeUndefined();
});
