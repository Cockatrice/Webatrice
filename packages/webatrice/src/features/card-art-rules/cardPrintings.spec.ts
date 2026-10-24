const hoisted = vi.hoisted(() => ({
  cardGet: vi.fn(),
  setGet: vi.fn(),
}));

vi.mock('@app/services', () => ({
  CardDTO: { get: hoisted.cardGet },
  SetDTO: { get: hoisted.setGet },
}));

import { loadCardPrintings } from './cardPrintings';

describe('loadCardPrintings', () => {
  it('labels each printing "<set long name> #<number>" keyed by its uuid', async () => {
    hoisted.cardGet.mockResolvedValue({
      name: { value: 'Island' },
      set: [
        { value: 'LEA', num: '288', uuid: 'u-1' },
        { value: 'XYZ', uuid: 'u-2' },
        { value: 'NOU', num: '5' },
      ],
    });
    hoisted.setGet.mockImplementation(async (code: string) => (
      code === 'LEA' ? { longname: { value: 'Limited Edition Alpha' } } : undefined
    ));

    await expect(loadCardPrintings(' Island ')).resolves.toEqual([
      { providerId: 'u-1', label: 'Limited Edition Alpha #288' },
      { providerId: 'u-2', label: 'XYZ' },
    ]);
    expect(hoisted.cardGet).toHaveBeenCalledWith('Island');
  });

  it('accepts a single-printing card', async () => {
    hoisted.cardGet.mockResolvedValue({ name: { value: 'Rare' }, set: { value: 'ABC', num: '1', uuid: 'only' } });
    hoisted.setGet.mockResolvedValue(undefined);
    await expect(loadCardPrintings('Rare')).resolves.toEqual([{ providerId: 'only', label: 'ABC #1' }]);
  });

  it('yields nothing for an unknown card, a blank name or a database error', async () => {
    hoisted.cardGet.mockResolvedValueOnce(undefined);
    await expect(loadCardPrintings('Nope')).resolves.toEqual([]);

    await expect(loadCardPrintings('   ')).resolves.toEqual([]);

    hoisted.cardGet.mockRejectedValueOnce(new Error('db closed'));
    await expect(loadCardPrintings('Island')).resolves.toEqual([]);
  });
});
