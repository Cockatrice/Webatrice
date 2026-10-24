import { ReplayFileDTO } from '../dexie/DexieDTOs';
import { REPLAY_LIBRARY_ROOT } from '../dexie/types';
import {
  emptyImportSummary,
  errorDetail,
  relativePathOf,
  type ImportFileOptions,
  type ImportSummary,
} from '../imports';
import { MAX_REPLAY_FILE_BYTES, REPLAY_FILE_EXTENSION, parseReplay } from './parseReplay';

const REPLAYS_FOLDER = 'replays';

export function replayFolderOf(relativePath: string): string | undefined {
  const folders = relativePath.split(/[\\/]/).filter(Boolean).slice(0, -1);
  const replaysIndex = folders.findLastIndex((folder) => folder.toLowerCase() === REPLAYS_FOLDER);
  return replaysIndex >= 0 ? folders[replaysIndex + 1] : folders[1];
}

function sameName(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.byteLength === b.byteLength && a.every((byte, index) => byte === b[index]);
}

class ReplayLibraryIndex {
  private bySize = new Map<number, number[]>();
  private data = new Map<number, Uint8Array>();
  private folders = new Map<string, number>();

  static async load(): Promise<ReplayLibraryIndex> {
    const index = new ReplayLibraryIndex();
    for (const entry of await ReplayFileDTO.getAll()) {
      if (entry.id == null) {
        continue;
      }
      if (entry.kind === 'replay') {
        index.bySize.set(entry.size, [...(index.bySize.get(entry.size) ?? []), entry.id]);
      } else if (entry.parentId === REPLAY_LIBRARY_ROOT) {
        index.folders.set(entry.name, entry.id);
      }
    }
    return index;
  }

  async contains(bytes: Uint8Array): Promise<boolean> {
    for (const id of this.bySize.get(bytes.byteLength) ?? []) {
      if (!this.data.has(id)) {
        this.data.set(id, (await ReplayFileDTO.readData(id)) ?? new Uint8Array());
      }
      if (sameBytes(this.data.get(id)!, bytes)) {
        return true;
      }
    }
    return false;
  }

  add(id: number, bytes: Uint8Array): void {
    this.bySize.set(bytes.byteLength, [...(this.bySize.get(bytes.byteLength) ?? []), id]);
    this.data.set(id, bytes);
  }

  async folderId(name: string | undefined): Promise<number> {
    if (!name) {
      return REPLAY_LIBRARY_ROOT;
    }
    const existing = [...this.folders].find(([folder]) => sameName(folder, name));
    if (existing) {
      return existing[1];
    }
    const id = await ReplayFileDTO.addFolder(REPLAY_LIBRARY_ROOT, name);
    this.folders.set(name, id);
    return id;
  }
}

export async function importReplayFiles(files: readonly File[], options: ImportFileOptions = {}): Promise<ImportSummary> {
  const summary = emptyImportSummary();
  const library = await ReplayLibraryIndex.load();

  for (const file of files) {
    if (options.isCancelled?.()) {
      break;
    }
    const name = file.name;
    if (!name.toLowerCase().endsWith(REPLAY_FILE_EXTENSION)) {
      summary.skipped.push({ name, reason: 'unsupported' });
      continue;
    }
    if (file.size > MAX_REPLAY_FILE_BYTES) {
      summary.failed.push({ name, reason: 'too-large' });
      continue;
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
      parseReplay(bytes);
    } catch (error) {
      summary.failed.push({ name, reason: 'invalid', detail: errorDetail(error) });
      continue;
    }
    if (await library.contains(bytes)) {
      summary.skipped.push({ name, reason: 'duplicate' });
      continue;
    }
    const folder = replayFolderOf(relativePathOf(file, options));
    try {
      const id = await ReplayFileDTO.addReplay(await library.folderId(folder), name, bytes);
      library.add(id, bytes);
      summary.imported.push(folder ? { name, folder } : { name });
    } catch (error) {
      summary.failed.push({ name, reason: 'save-failed', detail: errorDetail(error) });
    }
  }

  return summary;
}
