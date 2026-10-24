export const REPLAY_LIBRARY_ROOT = 0;

export type ReplayFileKind = 'folder' | 'replay';

export interface ReplayOrigin {
  endpoint: string;
  gameId: number;
  replayId: number;
}

export class ReplayFile {
  id?: number;
  parentId: number;
  kind: ReplayFileKind;
  name: string;
  size: number;
  modifiedAt: string;
  origin?: ReplayOrigin;
}

export class ReplayData {
  id: number;
  data: Uint8Array;
}
