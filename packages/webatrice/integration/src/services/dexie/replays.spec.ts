import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dexieService, REPLAY_LIBRARY_ROOT, ReplayFileDTO, ReplayNameTakenError } from '@app/services';
import { resetDexie } from './resetDexie';

const bytes = (...values: number[]) => new Uint8Array(values);
const contents = (data: Uint8Array | undefined) => (data ? Array.from(data) : undefined);

beforeEach(async () => {
  // Shared setup.ts installs fake timers for the websocket suite's
  // KeepAliveService; Dexie / fake-indexeddb need real timers.
  vi.useRealTimers();
  await resetDexie();
});

describe('ReplayFileDTO (real Dexie)', () => {
  it('stores a replay with its bytes kept out of the folder listing', async () => {
    const id = await ReplayFileDTO.addReplay(REPLAY_LIBRARY_ROOT, 'replay_1.cor', bytes(1, 2, 3));

    const [entry] = await ReplayFileDTO.listFolder(REPLAY_LIBRARY_ROOT);
    expect(entry).toBeInstanceOf(ReplayFileDTO);
    expect(entry).toMatchObject({ id, kind: 'replay', name: 'replay_1.cor', size: 3, parentId: REPLAY_LIBRARY_ROOT });
    expect(entry).not.toHaveProperty('data');
    expect(contents(await ReplayFileDTO.readData(id))).toEqual([1, 2, 3]);
  });

  it('renames an imported replay whose name is taken instead of overwriting it', async () => {
    await ReplayFileDTO.addReplay(REPLAY_LIBRARY_ROOT, 'replay_1.cor', bytes(1));
    await ReplayFileDTO.addReplay(REPLAY_LIBRARY_ROOT, 'replay_1.cor', bytes(2));

    const names = (await ReplayFileDTO.listFolder()).map((e) => e.name).sort();
    expect(names).toEqual(['replay_1 (2).cor', 'replay_1.cor']);
  });

  it('keeps folders separate and lists only direct children', async () => {
    const folder = await ReplayFileDTO.addFolder(REPLAY_LIBRARY_ROOT, 'Tournament');
    await ReplayFileDTO.addReplay(folder, 'round1.cor', bytes(1));
    await ReplayFileDTO.addReplay(REPLAY_LIBRARY_ROOT, 'casual.cor', bytes(2));

    expect((await ReplayFileDTO.listFolder(folder)).map((e) => e.name)).toEqual(['round1.cor']);
    expect((await ReplayFileDTO.listFolder()).map((e) => e.name).sort()).toEqual(['Tournament', 'casual.cor']);
  });

  it.each([
    ['deleted', async () => {
      const folder = await ReplayFileDTO.addFolder(REPLAY_LIBRARY_ROOT, 'Deleted');
      await ReplayFileDTO.delete([folder]);
      return folder;
    }],
    ['non-folder', () => ReplayFileDTO.addReplay(REPLAY_LIBRARY_ROOT, 'parent.cor', bytes(1))],
  ])('does not store a replay beneath a %s parent', async (_kind, makeParent) => {
    const parentId = await makeParent();
    const entriesBefore = await ReplayFileDTO.getAll();
    const dataBefore = await dexieService.replayData.count();

    await expect(ReplayFileDTO.addReplay(parentId, 'orphan.cor', bytes(2))).rejects.toThrow();

    expect(await ReplayFileDTO.getAll()).toEqual(entriesBefore);
    expect(await dexieService.replayData.count()).toBe(dataBefore);
  });

  it('refuses a folder or rename that would clash with a sibling', async () => {
    await ReplayFileDTO.addFolder(REPLAY_LIBRARY_ROOT, 'Tournament');
    const id = await ReplayFileDTO.addReplay(REPLAY_LIBRARY_ROOT, 'casual.cor', bytes(1));

    await expect(ReplayFileDTO.addFolder(REPLAY_LIBRARY_ROOT, 'tournament')).rejects.toBeInstanceOf(ReplayNameTakenError);
    await expect(ReplayFileDTO.rename(id, 'Tournament')).rejects.toBeInstanceOf(ReplayNameTakenError);

    await ReplayFileDTO.rename(id, 'casual game.cor');
    expect((await ReplayFileDTO.get(id))?.name).toBe('casual game.cor');
  });

  it('deleting a folder removes everything beneath it, bytes included', async () => {
    const outer = await ReplayFileDTO.addFolder(REPLAY_LIBRARY_ROOT, 'Outer');
    const inner = await ReplayFileDTO.addFolder(outer, 'Inner');
    const deep = await ReplayFileDTO.addReplay(inner, 'deep.cor', bytes(9));
    const kept = await ReplayFileDTO.addReplay(REPLAY_LIBRARY_ROOT, 'kept.cor', bytes(1));

    await ReplayFileDTO.delete([outer]);

    expect((await ReplayFileDTO.getAll()).map((e) => e.id)).toEqual([kept]);
    expect(await ReplayFileDTO.readData(deep)).toBeUndefined();
    expect(contents(await ReplayFileDTO.readData(kept))).toEqual([1]);
  });
});
