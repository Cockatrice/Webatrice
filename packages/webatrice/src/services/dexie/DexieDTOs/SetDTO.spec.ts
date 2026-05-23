import { vi } from 'vitest';

const setsTable = vi.hoisted(() => ({
  mapToClass: vi.fn(),
  put: vi.fn(() => Promise.resolve('set-key')),
  bulkPut: vi.fn(() => Promise.resolve('bulk-key')),
  where: vi.fn(),
}));

vi.mock('../DexieService', () => ({
  dexieService: { sets: setsTable },
}));

import { SetDTO } from './SetDTO';

describe('SetDTO', () => {
  beforeEach(() => {
    setsTable.put.mockClear();
    setsTable.bulkPut.mockClear();
    setsTable.where.mockReset();
  });

  it('registers itself with the sets table on import', () => {
    expect(setsTable.mapToClass).toHaveBeenCalledWith(SetDTO);
  });

  it('save() puts the instance into the sets table', async () => {
    const set = new SetDTO();
    const result = await set.save();
    expect(setsTable.put).toHaveBeenCalledWith(set);
    expect(result).toBe('set-key');
  });

  it('get() looks up a set by name (case-insensitive)', async () => {
    const first = vi.fn(() => Promise.resolve({ name: { value: 'KHM' } }));
    const equalsIgnoreCase = vi.fn(() => ({ first }));
    setsTable.where.mockReturnValue({ equalsIgnoreCase });

    const result = await SetDTO.get('khm');

    expect(setsTable.where).toHaveBeenCalledWith('name.value');
    expect(equalsIgnoreCase).toHaveBeenCalledWith('khm');
    expect(result).toEqual({ name: { value: 'KHM' } });
  });

  it('bulkAdd() bulk-puts an array of sets', async () => {
    const sets = [new SetDTO()];
    const result = await SetDTO.bulkAdd(sets);
    expect(setsTable.bulkPut).toHaveBeenCalledWith(sets);
    expect(result).toBe('bulk-key');
  });
});
