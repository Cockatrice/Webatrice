import { z } from 'zod';
import { readLocalStorage, writeLocalStorage } from './localStorage';

const count = z.number().int().nonnegative();
const label = z.string().max(512);
const room = z.object({ id: count, name: label, games: count, people: count });
const schema = z.object({
  version: z.literal(1),
  host: label,
  userName: label,
  serverName: label,
  onlineCount: count,
  gamesRunning: count,
  rooms: z.array(room).max(256),
  usualRoomId: count.nullable(),
  openGames: z.array(z.object({ id: count, name: label, players: count, maxPlayers: count })).max(2),
  buddiesOnline: count,
  buddyCount: count,
});

export type HomeSnapshot = z.infer<typeof schema>;
export const HOME_SNAPSHOT_KEY = 'webatrice.homeSnapshot';
const snapshotsSchema = z.record(z.string(), schema);
const accountKey = (host: string, userName: string) => JSON.stringify([host, userName]);

function readSnapshots(): Record<string, HomeSnapshot> {
  const raw = readLocalStorage(HOME_SNAPSHOT_KEY);
  if (!raw || raw.length > 64_000) {
    return {};
  }
  try {
    const result = snapshotsSchema.safeParse(JSON.parse(raw));
    return result.success && Object.keys(result.data).length <= 4 ? result.data : {};
  } catch {
    return {};
  }
}

export function loadHomeSnapshot(host: string, userName: string): HomeSnapshot | null {
  const snapshot = readSnapshots()[accountKey(host, userName)];
  return snapshot?.host === host && snapshot.userName === userName ? snapshot : null;
}

export function saveHomeSnapshot(snapshot: HomeSnapshot): void {
  const result = schema.safeParse(snapshot);
  if (result.success) {
    const key = accountKey(snapshot.host, snapshot.userName);
    const entries = Object.entries(readSnapshots()).filter(([existing]) => existing !== key);
    entries.push([key, result.data]);
    while (entries.length > 4) {
      entries.shift();
    }
    let raw = JSON.stringify(Object.fromEntries(entries));
    while (raw.length > 64_000 && entries.length > 0) {
      entries.shift();
      raw = JSON.stringify(Object.fromEntries(entries));
    }
    if (entries.length > 0) {
      writeLocalStorage(HOME_SNAPSHOT_KEY, raw);
    }
  }
}

export function clearHomeSnapshot(): void {
  revision += 1;
  writeLocalStorage(HOME_SNAPSHOT_KEY, '');
  homePreview.set(null);
}

let preview: HomeSnapshot | null = null;
let revision = 0;
const listeners = new Set<() => void>();

export const homePreview = {
  get revision() {
    return revision;
  },
  get: () => preview,
  set(value: HomeSnapshot | null): void {
    if (preview === value) {
      return;
    }
    preview = value;
    listeners.forEach(listener => listener());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
