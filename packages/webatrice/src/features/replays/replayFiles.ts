import { REPLAY_FILE_EXTENSION } from '@app/services';
import { downloadBlob } from '@app/utils';

export { MAX_REPLAY_FILE_BYTES } from '@app/services';

export function saveReplayFile(data: Uint8Array, fileName: string): void {
  const name = fileName.toLowerCase().endsWith(REPLAY_FILE_EXTENSION) ? fileName : `${fileName}${REPLAY_FILE_EXTENSION}`;
  downloadBlob(data as BlobPart, name, 'application/octet-stream');
}

export function hasReplayExtension(file: File): boolean {
  return file.name.toLowerCase().endsWith(REPLAY_FILE_EXTENSION);
}

export function splitReplayName(name: string): { base: string; extension: string } {
  const extension = name.toLowerCase().endsWith(REPLAY_FILE_EXTENSION) ? name.slice(-REPLAY_FILE_EXTENSION.length) : '';
  return { base: extension ? name.slice(0, -extension.length) : name, extension };
}

export async function readReplayFile(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}
