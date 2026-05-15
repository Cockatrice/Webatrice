import { vi } from 'vitest';

const infoTable = vi.hoisted(() => ({
  mapToClass: vi.fn(),
  put: vi.fn(() => Promise.resolve('info-key')),
  get: vi.fn(() => Promise.resolve({ id: 'singleton' })),
}));

vi.mock('../DexieService', () => ({
  dexieService: { info: infoTable },
}));

import { InfoDTO } from './InfoDTO';

describe('InfoDTO', () => {
  beforeEach(() => {
    infoTable.put.mockClear();
    infoTable.get.mockClear();
  });

  it('registers itself with the info table on import', () => {
    expect(infoTable.mapToClass).toHaveBeenCalledWith(InfoDTO);
  });

  it('defaults the source and stamps importedAt when constructed without args', () => {
    const before = Date.now();
    const info = new InfoDTO();
    expect(info.id).toBe('singleton');
    expect(info.source).toBe('oracle-local-fs');
    expect(info.sourceUrl).toBeUndefined();
    expect(info.author).toBeUndefined();
    expect(Date.parse(info.importedAt)).toBeGreaterThanOrEqual(before);
  });

  it('copies provided fields and honors an explicit importedAt', () => {
    const info = new InfoDTO({
      source: 'oracle-local-fs',
      sourceUrl: 'https://example.com',
      sourceVersion: 'v2',
      author: 'tester',
      createdAt: '2024-01-01T00:00:00.000Z',
      importedAt: '2024-02-02T00:00:00.000Z',
    });
    expect(info.sourceUrl).toBe('https://example.com');
    expect(info.sourceVersion).toBe('v2');
    expect(info.author).toBe('tester');
    expect(info.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(info.importedAt).toBe('2024-02-02T00:00:00.000Z');
  });

  it('save() puts the instance into the info table', async () => {
    const info = new InfoDTO();
    const result = await info.save();
    expect(infoTable.put).toHaveBeenCalledWith(info);
    expect(result).toBe('info-key');
  });

  it('get() reads the singleton row', async () => {
    const result = await InfoDTO.get();
    expect(infoTable.get).toHaveBeenCalledWith('singleton');
    expect(result).toEqual({ id: 'singleton' });
  });
});
