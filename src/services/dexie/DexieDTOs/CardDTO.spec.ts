import { vi } from 'vitest';

const cardsTable = vi.hoisted(() => ({
  mapToClass: vi.fn(),
  put: vi.fn(() => Promise.resolve('card-key')),
  bulkPut: vi.fn(() => Promise.resolve('bulk-key')),
  where: vi.fn(),
}));

vi.mock('../DexieService', () => ({
  dexieService: { cards: cardsTable },
}));

import { CardDTO } from './CardDTO';

describe('CardDTO', () => {
  beforeEach(() => {
    cardsTable.put.mockClear();
    cardsTable.bulkPut.mockClear();
    cardsTable.where.mockReset();
  });

  it('registers itself with the cards table on import', () => {
    expect(cardsTable.mapToClass).toHaveBeenCalledWith(CardDTO);
  });

  it('save() puts the instance into the cards table', async () => {
    const card = new CardDTO();
    const result = await card.save();
    expect(cardsTable.put).toHaveBeenCalledWith(card);
    expect(result).toBe('card-key');
  });

  it('get() looks up a card by name (case-insensitive)', async () => {
    const first = vi.fn(() => Promise.resolve({ found: true }));
    const equalsIgnoreCase = vi.fn(() => ({ first }));
    cardsTable.where.mockReturnValue({ equalsIgnoreCase });

    const result = await CardDTO.get('Lightning Bolt');

    expect(cardsTable.where).toHaveBeenCalledWith('name.value');
    expect(equalsIgnoreCase).toHaveBeenCalledWith('Lightning Bolt');
    expect(result).toEqual({ found: true });
  });

  it('bulkAdd() bulk-puts an array of cards', async () => {
    const cards = [new CardDTO(), new CardDTO()];
    const result = await CardDTO.bulkAdd(cards);
    expect(cardsTable.bulkPut).toHaveBeenCalledWith(cards);
    expect(result).toBe('bulk-key');
  });
});
