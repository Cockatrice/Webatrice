import { vi } from 'vitest';

const hostsTable = vi.hoisted(() => ({
  mapToClass: vi.fn(),
  put: vi.fn(() => Promise.resolve('host-key')),
  add: vi.fn(() => Promise.resolve(1)),
  bulkAdd: vi.fn(() => Promise.resolve('bulk-key')),
  delete: vi.fn(() => Promise.resolve()),
  toArray: vi.fn(() => Promise.resolve([{ id: 1 }])),
  where: vi.fn(),
}));

vi.mock('../DexieService', () => ({
  dexieService: { hosts: hostsTable },
}));

import { HostDTO } from './HostDTO';

describe('HostDTO', () => {
  beforeEach(() => {
    hostsTable.put.mockClear();
    hostsTable.add.mockClear();
    hostsTable.bulkAdd.mockClear();
    hostsTable.delete.mockClear();
    hostsTable.toArray.mockClear();
    hostsTable.where.mockReset();
  });

  it('registers itself with the hosts table on import', () => {
    expect(hostsTable.mapToClass).toHaveBeenCalledWith(HostDTO);
  });

  it('save() puts the instance into the hosts table', async () => {
    const host = new HostDTO();
    const result = await host.save();
    expect(hostsTable.put).toHaveBeenCalledWith(host);
    expect(result).toBe('host-key');
  });

  it('add() adds a host', async () => {
    const host = { name: 'srv' } as any;
    const result = await HostDTO.add(host);
    expect(hostsTable.add).toHaveBeenCalledWith(host);
    expect(result).toBe(1);
  });

  it('get() looks up a host by id', async () => {
    const first = vi.fn(() => Promise.resolve({ id: 5 }));
    const equals = vi.fn(() => ({ first }));
    hostsTable.where.mockReturnValue({ equals });

    const result = await HostDTO.get(5);

    expect(hostsTable.where).toHaveBeenCalledWith('id');
    expect(equals).toHaveBeenCalledWith(5);
    expect(result).toEqual({ id: 5 });
  });

  it('getAll() returns every host', async () => {
    const result = await HostDTO.getAll();
    expect(hostsTable.toArray).toHaveBeenCalled();
    expect(result).toEqual([{ id: 1 }]);
  });

  it('bulkAdd() bulk-adds an array of hosts', async () => {
    const hosts = [{ name: 'a' }, { name: 'b' }] as any;
    const result = await HostDTO.bulkAdd(hosts);
    expect(hostsTable.bulkAdd).toHaveBeenCalledWith(hosts);
    expect(result).toBe('bulk-key');
  });

  it('delete() removes a host by id', async () => {
    await HostDTO.delete(9);
    expect(hostsTable.delete).toHaveBeenCalledWith(9);
  });
});
