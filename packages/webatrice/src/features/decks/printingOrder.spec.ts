import type { DeckCard } from './types';
import { bumpPrintingsInDeck } from './printingOrder';

const card = (overrides: Partial<DeckCard>): DeckCard => ({
  name: 'Lightning Bolt', quantity: 1, category: 'main', lookupSource: 'scryfall', ...overrides,
});
const m11 = { set: 'm11', collectorNumber: '149', scryfallId: 'm11-id' };
const a25 = { set: 'a25', collectorNumber: '141', scryfallId: 'a25-id' };
const lea = { set: 'lea', collectorNumber: '161' };
const sta = { set: 'sta', collectorNumber: '42', scryfallId: 'sta-id' };

describe('bumpPrintingsInDeck', () => {
  it('puts the printings the main deck holds first, most copies first, and keeps the rest in order', () => {
    const deck = [
      card({ scryfallId: 'a25-id', quantity: 1 }),
      card({ scryfallId: 'sta-id', quantity: 3 }),
      card({ set: 'lea', collectorNumber: '161', quantity: 2 }),
    ];
    expect(bumpPrintingsInDeck([m11, a25, lea, sta], 'Lightning Bolt', deck)).toEqual([sta, lea, a25, m11]);
  });

  it('counts only the main zone and only this card', () => {
    const deck = [
      card({ scryfallId: 'a25-id', category: 'sideboard', quantity: 4 }),
      card({ name: 'Shock', scryfallId: 'sta-id', quantity: 4 }),
    ];
    expect(bumpPrintingsInDeck([m11, a25, sta], 'Lightning Bolt', deck)).toEqual([m11, a25, sta]);
  });
});
