import { vi } from 'vitest';

const tokensTable = vi.hoisted(() => ({
  mapToClass: vi.fn(),
  put: vi.fn(() => Promise.resolve('token-key')),
  bulkPut: vi.fn(() => Promise.resolve('bulk-key')),
  where: vi.fn(),
}));

vi.mock('../DexieService', () => ({
  dexieService: { tokens: tokensTable },
}));

import { TokenDTO } from './TokenDTO';

describe('TokenDTO', () => {
  beforeEach(() => {
    tokensTable.put.mockClear();
    tokensTable.bulkPut.mockClear();
    tokensTable.where.mockReset();
  });

  it('registers itself with the tokens table on import', () => {
    expect(tokensTable.mapToClass).toHaveBeenCalledWith(TokenDTO);
  });

  it('save() puts the instance into the tokens table', async () => {
    const token = new TokenDTO();
    const result = await token.save();
    expect(tokensTable.put).toHaveBeenCalledWith(token);
    expect(result).toBe('token-key');
  });

  it('get() looks up a token by name (case-insensitive)', async () => {
    const first = vi.fn(() => Promise.resolve({ name: { value: 'Goblin' } }));
    const equalsIgnoreCase = vi.fn(() => ({ first }));
    tokensTable.where.mockReturnValue({ equalsIgnoreCase });

    const result = await TokenDTO.get('goblin');

    expect(tokensTable.where).toHaveBeenCalledWith('name.value');
    expect(equalsIgnoreCase).toHaveBeenCalledWith('goblin');
    expect(result).toEqual({ name: { value: 'Goblin' } });
  });

  it('bulkAdd() bulk-puts an array of tokens', async () => {
    const tokens = [new TokenDTO(), new TokenDTO()];
    const result = await TokenDTO.bulkAdd(tokens);
    expect(tokensTable.bulkPut).toHaveBeenCalledWith(tokens);
    expect(result).toBe('bulk-key');
  });
});
