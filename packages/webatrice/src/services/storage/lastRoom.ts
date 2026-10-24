import { readLocalStorage, writeLocalStorage } from './localStorage';

const LAST_ROOM_STORAGE_KEY = 'webatrice.lastRoom';

interface LastRoom {
  owner: string;
  roomId: number;
}

function isLastRoom(value: unknown): value is LastRoom {
  const { owner, roomId } = (value ?? {}) as Partial<LastRoom>;
  return typeof owner === 'string' && Number.isInteger(roomId) && (roomId as number) >= 0;
}

export function persistLastRoomId(owner: string, roomId: number): void {
  writeLocalStorage(LAST_ROOM_STORAGE_KEY, JSON.stringify({ owner, roomId }));
}

export function loadPersistedLastRoomId(owner: string): number | null {
  try {
    const last: unknown = JSON.parse(readLocalStorage(LAST_ROOM_STORAGE_KEY) ?? 'null');
    return isLastRoom(last) && last.owner === owner ? last.roomId : null;
  } catch {
    return null;
  }
}
