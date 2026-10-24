import type { ServerInfo_ReplayMatch } from '@cockatrice/sockatrice/generated';
import { REPLAY_FILE_EXTENSION, REPLAY_LIBRARY_ROOT, type ReplayFileDTO } from '@app/services';

export type ReplaySource = 'all' | 'server' | 'local';

export interface LibraryGame {
  replayId: number;
  name: string;
  durationSec: number;
  localEntryId: number | undefined;
}

export interface MatchItem {
  kind: 'match';
  id: string;
  gameId: number;
  name: string;
  room: string;
  players: string[];
  startedAt: number | undefined;
  durationSec: number;
  keep: boolean;
  games: LibraryGame[];
  localFolder: string | undefined;
}

export interface FileItem {
  kind: 'file';
  id: string;
  entryId: number;
  name: string;
  folder: string | undefined;
  sizeBytes: number;
  modifiedAt: number;
}

export type ReplayItem = MatchItem | FileItem;

export type DayGroup = 'today' | 'yesterday' | 'week' | 'older';

export interface DayGroupItems {
  group: DayGroup;
  items: ReplayItem[];
}

export function itemDate(item: ReplayItem): number {
  return item.kind === 'match' ? item.startedAt ?? 0 : item.modifiedAt;
}

export function savedGameCount(item: MatchItem): number {
  return item.games.filter((game) => game.localEntryId != null).length;
}

export function isSavedLocally(item: MatchItem): boolean {
  return savedGameCount(item) > 0;
}

export function isFullySaved(item: MatchItem): boolean {
  return item.games.length > 0 && savedGameCount(item) === item.games.length;
}

export function buildReplayItems(
  matches: readonly ServerInfo_ReplayMatch[],
  entries: readonly ReplayFileDTO[],
  endpoint: string,
): ReplayItem[] {
  const folders = new Map(entries.filter((e) => e.kind === 'folder' && e.id != null).map((e) => [e.id!, e]));
  const folderOf = (entry: ReplayFileDTO) =>
    entry.parentId === REPLAY_LIBRARY_ROOT ? undefined : folders.get(entry.parentId)?.name;
  const files = entries.filter((e) => e.kind === 'replay' && e.id != null);
  const byOrigin = new Map<string, ReplayFileDTO>();
  for (const file of files) {
    const origin = file.origin;
    if (origin && origin.endpoint === endpoint) {
      const id = `${origin.gameId}/${origin.replayId}`;
      if (!byOrigin.has(id)) {
        byOrigin.set(id, file);
      }
    }
  }
  const linked = new Set<number>();

  const matchItems = matches.map<MatchItem>((match) => {
    const games = match.replayList.map<LibraryGame>((replay) => {
      const entry = byOrigin.get(`${match.gameId}/${replay.replayId}`);
      if (entry?.id != null) {
        linked.add(entry.id);
      }
      return {
        replayId: replay.replayId,
        name: replay.replayName,
        durationSec: replay.duration,
        localEntryId: entry?.id,
      };
    });
    const savedEntry = games
      .map((g) => (g.localEntryId != null ? byOrigin.get(`${match.gameId}/${g.replayId}`) : undefined))
      .find((e) => e);
    return {
      kind: 'match',
      id: `match:${match.gameId}`,
      gameId: match.gameId,
      name: match.gameName,
      room: match.roomName,
      players: [...match.playerNames],
      startedAt: match.timeStarted ? match.timeStarted * 1000 : undefined,
      durationSec: match.length,
      keep: match.doNotHide,
      games,
      localFolder: savedEntry ? folderOf(savedEntry) : undefined,
    };
  });

  const fileItems = files
    .filter((file) => !linked.has(file.id!))
    .map<FileItem>((file) => ({
      kind: 'file',
      id: `file:${file.id}`,
      entryId: file.id!,
      name: file.name.toLowerCase().endsWith(REPLAY_FILE_EXTENSION) ? file.name.slice(0, -REPLAY_FILE_EXTENSION.length) : file.name,
      folder: folderOf(file),
      sizeBytes: file.size,
      modifiedAt: Date.parse(file.modifiedAt) || 0,
    }));

  return [...matchItems, ...fileItems].sort((a, b) => itemDate(b) - itemDate(a));
}

export function matchesSource(item: ReplayItem, source: ReplaySource): boolean {
  if (source === 'all') {
    return true;
  }
  if (item.kind === 'file') {
    return source === 'local';
  }
  return source === 'server' || isSavedLocally(item);
}

export function matchesQuery(item: ReplayItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const haystack = item.kind === 'match'
    ? [item.name, item.room, ...item.players, ...item.games.map((g) => g.name)]
    : [item.name, item.folder ?? ''];
  return haystack.some((text) => text.toLowerCase().includes(needle));
}

export function filterReplayItems(items: readonly ReplayItem[], source: ReplaySource, query: string): ReplayItem[] {
  return items.filter((item) => matchesSource(item, source) && matchesQuery(item, query));
}

export function sourceCounts(items: readonly ReplayItem[]): Record<ReplaySource, number> {
  return {
    all: items.length,
    server: items.filter((item) => matchesSource(item, 'server')).length,
    local: items.filter((item) => matchesSource(item, 'local')).length,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function dayGroupOf(time: number, now: number): DayGroup {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  if (time >= today) {
    return 'today';
  }
  if (time >= today - DAY_MS) {
    return 'yesterday';
  }
  if (time >= today - 6 * DAY_MS) {
    return 'week';
  }
  return 'older';
}

export function groupByDay(items: readonly ReplayItem[], now: number): DayGroupItems[] {
  const order: DayGroup[] = ['today', 'yesterday', 'week', 'older'];
  const buckets = new Map<DayGroup, ReplayItem[]>(order.map((group) => [group, []]));
  for (const item of items) {
    buckets.get(dayGroupOf(itemDate(item), now))!.push(item);
  }
  return order.filter((group) => buckets.get(group)!.length > 0).map((group) => ({ group, items: buckets.get(group)! }));
}
