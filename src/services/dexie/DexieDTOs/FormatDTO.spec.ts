import { vi } from 'vitest';

const formatsTable = vi.hoisted(() => ({
  mapToClass: vi.fn(),
  put: vi.fn(() => Promise.resolve('format-key')),
  bulkPut: vi.fn(() => Promise.resolve('bulk-key')),
  toArray: vi.fn(() => Promise.resolve([{ formatName: 'Standard' }])),
  where: vi.fn(),
}));

vi.mock('../DexieService', () => ({
  dexieService: { formats: formatsTable },
}));

import { FormatDTO } from './FormatDTO';

describe('FormatDTO', () => {
  beforeEach(() => {
    formatsTable.put.mockClear();
    formatsTable.bulkPut.mockClear();
    formatsTable.toArray.mockClear();
    formatsTable.where.mockReset();
  });

  it('registers itself with the formats table on import', () => {
    expect(formatsTable.mapToClass).toHaveBeenCalledWith(FormatDTO);
  });

  it('save() puts the instance into the formats table', async () => {
    const format = new FormatDTO();
    const result = await format.save();
    expect(formatsTable.put).toHaveBeenCalledWith(format);
    expect(result).toBe('format-key');
  });

  it('get() looks up a format by name (case-insensitive)', async () => {
    const first = vi.fn(() => Promise.resolve({ formatName: 'Modern' }));
    const equalsIgnoreCase = vi.fn(() => ({ first }));
    formatsTable.where.mockReturnValue({ equalsIgnoreCase });

    const result = await FormatDTO.get('modern');

    expect(formatsTable.where).toHaveBeenCalledWith('formatName');
    expect(equalsIgnoreCase).toHaveBeenCalledWith('modern');
    expect(result).toEqual({ formatName: 'Modern' });
  });

  it('getAll() returns every format', async () => {
    const result = await FormatDTO.getAll();
    expect(formatsTable.toArray).toHaveBeenCalled();
    expect(result).toEqual([{ formatName: 'Standard' }]);
  });

  it('bulkAdd() bulk-puts an array of formats', async () => {
    const formats = [new FormatDTO()];
    const result = await FormatDTO.bulkAdd(formats);
    expect(formatsTable.bulkPut).toHaveBeenCalledWith(formats);
    expect(result).toBe('bulk-key');
  });
});
