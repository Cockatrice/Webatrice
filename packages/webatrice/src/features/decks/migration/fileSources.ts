export interface SourceFile {
  file: File;
  path: string;
}

function cleanPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function fromInputFiles(files: Iterable<File>): SourceFile[] {
  return Array.from(files, (file) => ({ file, path: cleanPath(file.webkitRelativePath || file.name) }));
}

interface FsEntry {
  isFile: boolean;
  isDirectory: boolean;
  fullPath: string;
  file?: (onFile: (file: File) => void, onError: (error: unknown) => void) => void;
  createReader?: () => { readEntries: (onEntries: (entries: FsEntry[]) => void, onError: (error: unknown) => void) => void };
}

function readAll(entry: FsEntry): Promise<FsEntry[]> {
  const reader = entry.createReader?.();
  if (!reader) {
    return Promise.resolve([]);
  }
  const out: FsEntry[] = [];
  return new Promise((resolve, reject) => {
    const next = () => reader.readEntries((batch) => {
      if (batch.length === 0) {
        resolve(out);
      } else {
        out.push(...batch);
        next();
      }
    }, reject);
    next();
  });
}

async function walk(entry: FsEntry, out: SourceFile[]): Promise<void> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => entry.file!(resolve, reject));
    out.push({ file, path: cleanPath(entry.fullPath || file.name) });
  } else if (entry.isDirectory) {
    for (const child of await readAll(entry)) {
      await walk(child, out);
    }
  }
}

export async function fromDataTransfer(data: DataTransfer): Promise<SourceFile[]> {
  const entries = Array.from(data.items ?? [])
    .map((item) => (item.kind === 'file' ? (item.webkitGetAsEntry?.() as FsEntry | null) : null))
    .filter((entry): entry is FsEntry => entry != null);
  if (entries.length === 0) {
    return fromInputFiles(Array.from(data.files ?? []));
  }
  const out: SourceFile[] = [];
  for (const entry of entries) {
    await walk(entry, out);
  }
  return out;
}

export function dragHasFiles(data: DataTransfer | null): boolean {
  return Array.from(data?.types ?? []).includes('Files');
}
