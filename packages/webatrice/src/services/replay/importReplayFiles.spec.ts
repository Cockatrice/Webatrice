import { toBinary } from '@bufbuild/protobuf';
import { GameReplaySchema } from '@cockatrice/sockatrice/generated';

import { ReplayFileDTO } from '../dexie/DexieDTOs';
import { REPLAY_LIBRARY_ROOT } from '../dexie/types';
import { buildReplay, sayContainer } from './__mocks__/fixtures';
import { importReplayFiles, replayFolderOf } from './importReplayFiles';
import { MAX_REPLAY_FILE_BYTES } from './parseReplay';

const replayBytes = (message = 'hello') => toBinary(GameReplaySchema, buildReplay([sayContainer(0, message)]));

function replayFile(name: string, bytes: Uint8Array, relativePath?: string): File {
  const file = new File([bytes as BlobPart], name);
  if (relativePath) {
    Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
  }
  return file;
}

function entry(id: number, kind: 'replay' | 'folder', name: string, size = 0, parentId = REPLAY_LIBRARY_ROOT) {
  return Object.assign(new ReplayFileDTO(), { id, kind, name, size, parentId, modifiedAt: '' });
}

describe('replayFolderOf', () => {
  it.each([
    ['game.cor', undefined],
    ['replays/game.cor', undefined],
    ['replays/2025/game.cor', '2025'],
    ['Cockatrice/replays/2025/game.cor', '2025'],
    ['Cockatrice/replays/2025/january/game.cor', '2025'],
    ['Exports/game.cor', undefined],
    ['Exports/Tournament/game.cor', 'Tournament'],
    ['C:\\Users\\me\\Replays\\Cube\\game.cor', 'Cube'],
  ])('puts %s in folder %s', (path, folder) => {
    expect(replayFolderOf(path)).toBe(folder);
  });
});

describe('importReplayFiles', () => {
  let nextId: number;

  beforeEach(() => {
    nextId = 100;
    vi.spyOn(ReplayFileDTO, 'getAll').mockResolvedValue([]);
    vi.spyOn(ReplayFileDTO, 'readData').mockResolvedValue(undefined);
    vi.spyOn(ReplayFileDTO, 'addReplay').mockImplementation(async () => nextId++);
    vi.spyOn(ReplayFileDTO, 'addFolder').mockImplementation(async () => nextId++);
  });

  it('imports replays and skips files that are not replays', async () => {
    const bytes = replayBytes();

    const summary = await importReplayFiles([replayFile('a.cor', bytes), replayFile('notes.txt', new Uint8Array([1]))]);

    expect(summary).toEqual({
      imported: [{ name: 'a.cor' }],
      skipped: [{ name: 'notes.txt', reason: 'unsupported' }],
      failed: [],
    });
    expect(ReplayFileDTO.addReplay).toHaveBeenCalledWith(REPLAY_LIBRARY_ROOT, 'a.cor', bytes);
  });

  it('reports unreadable and oversized replays as failures', async () => {
    const huge = replayFile('huge.cor', new Uint8Array([1]));
    Object.defineProperty(huge, 'size', { value: MAX_REPLAY_FILE_BYTES + 1 });

    const summary = await importReplayFiles([replayFile('broken.cor', new Uint8Array([0xff, 0xff, 0xff])), huge]);

    expect(summary.imported).toEqual([]);
    expect(summary.failed).toEqual([
      { name: 'broken.cor', reason: 'invalid', detail: expect.any(String) },
      { name: 'huge.cor', reason: 'too-large' },
    ]);
    expect(ReplayFileDTO.addReplay).not.toHaveBeenCalled();
  });

  it('skips replays whose bytes are already in the library or earlier in the batch', async () => {
    const stored = replayBytes('stored');
    const fresh = replayBytes('fresh');
    vi.mocked(ReplayFileDTO.getAll).mockResolvedValue([entry(1, 'replay', 'old.cor', stored.byteLength)]);
    vi.mocked(ReplayFileDTO.readData).mockResolvedValue(stored);

    const summary = await importReplayFiles([
      replayFile('again.cor', stored),
      replayFile('fresh.cor', fresh),
      replayFile('fresh copy.cor', fresh),
    ]);

    expect(summary.imported).toEqual([{ name: 'fresh.cor' }]);
    expect(summary.skipped).toEqual([
      { name: 'again.cor', reason: 'duplicate' },
      { name: 'fresh copy.cor', reason: 'duplicate' },
    ]);
  });

  it('keeps one folder level, reusing an existing folder and creating missing ones once', async () => {
    vi.mocked(ReplayFileDTO.getAll).mockResolvedValue([entry(5, 'folder', '2025')]);

    const summary = await importReplayFiles([
      replayFile('a.cor', replayBytes('a'), 'Cockatrice/replays/2025/a.cor'),
      replayFile('b.cor', replayBytes('b'), 'Cockatrice/replays/2026/b.cor'),
      replayFile('c.cor', replayBytes('c'), 'Cockatrice/replays/2026/deep/c.cor'),
      replayFile('d.cor', replayBytes('d'), 'Cockatrice/replays/d.cor'),
    ]);

    expect(summary.imported).toEqual([
      { name: 'a.cor', folder: '2025' },
      { name: 'b.cor', folder: '2026' },
      { name: 'c.cor', folder: '2026' },
      { name: 'd.cor' },
    ]);
    expect(ReplayFileDTO.addFolder).toHaveBeenCalledTimes(1);
    expect(ReplayFileDTO.addFolder).toHaveBeenCalledWith(REPLAY_LIBRARY_ROOT, '2026');
    expect(vi.mocked(ReplayFileDTO.addReplay).mock.calls.map(([parentId]) => parentId)).toEqual([5, 101, 101, REPLAY_LIBRARY_ROOT]);
  });

  it('takes the relative path from the caller for dropped folders', async () => {
    const summary = await importReplayFiles(
      [replayFile('a.cor', replayBytes())],
      { relativePathOf: () => 'replays/Cube/a.cor' },
    );

    expect(summary.imported).toEqual([{ name: 'a.cor', folder: 'Cube' }]);
  });

  it('reports a replay the library could not save', async () => {
    vi.mocked(ReplayFileDTO.addReplay).mockRejectedValue(new Error('quota'));

    const summary = await importReplayFiles([replayFile('a.cor', replayBytes())]);

    expect(summary.failed).toEqual([{ name: 'a.cor', reason: 'save-failed', detail: 'quota' }]);
  });
});
