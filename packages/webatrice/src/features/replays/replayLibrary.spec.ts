import { create } from '@bufbuild/protobuf';
import { ServerInfo_ReplayMatchSchema, ServerInfo_ReplaySchema } from '@cockatrice/sockatrice/generated';
import { REPLAY_LIBRARY_ROOT, ReplayFileDTO, type ReplayOrigin } from '@app/services';

import {
  buildReplayItems,
  dayGroupOf,
  filterReplayItems,
  groupByDay,
  isFullySaved,
  savedGameCount,
  sourceCounts,
  type MatchItem,
} from './replayLibrary';

const HERE = 'wss://server.example:4748/';

function match(gameId: number, replayIds: number[], overrides: Partial<{ timeStarted: number; gameName: string; players: string[] }> = {}) {
  return create(ServerInfo_ReplayMatchSchema, {
    gameId,
    gameName: overrides.gameName ?? `Game ${gameId}`,
    roomName: 'Main',
    playerNames: overrides.players ?? ['alice', 'bob'],
    timeStarted: overrides.timeStarted ?? 1_700_000_000,
    length: 300,
    doNotHide: false,
    replayList: replayIds.map((replayId) => create(ServerInfo_ReplaySchema, { replayId, replayName: `Replay ${replayId}`, duration: 120 })),
  });
}

function entry(
  id: number,
  name: string,
  kind: 'folder' | 'replay' = 'replay',
  parentId = REPLAY_LIBRARY_ROOT,
  modifiedAt = '2023-01-01T12:00:00.000Z',
  origin?: ReplayOrigin,
) {
  return Object.assign(new ReplayFileDTO(), { id, name, kind, parentId, size: kind === 'replay' ? 2048 : 0, modifiedAt, origin });
}

const from = (gameId: number, replayId: number, endpoint = HERE): ReplayOrigin => ({ endpoint, gameId, replayId });

describe('buildReplayItems', () => {
  it('joins library copies to their server game by recorded origin and keeps the rest as files', () => {
    const items = buildReplayItems(
      [match(7, [70, 71]), match(9, [90])],
      [
        entry(1, '7_Game 7', 'folder'),
        entry(2, 'replay_70.cor', 'replay', 1, undefined, from(7, 70)),
        entry(3, 'draft.cor'),
        entry(4, 'replay_90.cor'),
        entry(5, 'replay_90.cor', 'replay', REPLAY_LIBRARY_ROOT, undefined, from(9, 90, 'wss://elsewhere.example:4748/')),
      ],
      HERE,
    );

    expect(items.map((i) => i.id)).toEqual(['match:7', 'match:9', 'file:3', 'file:4', 'file:5']);
    const seven = items[0] as MatchItem;
    expect(seven.games).toEqual([
      { replayId: 70, name: 'Replay 70', durationSec: 120, localEntryId: 2 },
      { replayId: 71, name: 'Replay 71', durationSec: 120, localEntryId: undefined },
    ]);
    expect(seven.localFolder).toBe('7_Game 7');
    expect(seven).toMatchObject({ players: ['alice', 'bob'], startedAt: 1_700_000_000_000, durationSec: 300, keep: false });
    expect((items[1] as MatchItem).games[0].localEntryId).toBeUndefined();
    expect(items[2]).toMatchObject({ kind: 'file', entryId: 3, name: 'draft', folder: undefined, sizeBytes: 2048 });
  });

  it('tells a partly saved match from a complete one', () => {
    const [partial, complete, none] = buildReplayItems(
      [match(7, [70, 71]), match(8, [80]), match(9, [90])],
      [
        entry(2, 'a.cor', 'replay', REPLAY_LIBRARY_ROOT, undefined, from(7, 70)),
        entry(3, 'b.cor', 'replay', REPLAY_LIBRARY_ROOT, undefined, from(8, 80)),
      ],
      HERE,
    ) as MatchItem[];

    expect([savedGameCount(partial), isFullySaved(partial)]).toEqual([1, false]);
    expect([savedGameCount(complete), isFullySaved(complete)]).toEqual([1, true]);
    expect([savedGameCount(none), isFullySaved(none)]).toEqual([0, false]);
  });

  it('orders newest first across both sources', () => {
    const items = buildReplayItems(
      [match(1, [10], { timeStarted: 1_700_000_000 })],
      [
        entry(5, 'later.cor', 'replay', REPLAY_LIBRARY_ROOT, '2024-01-01T00:00:00.000Z'),
        entry(6, 'earlier.cor', 'replay', REPLAY_LIBRARY_ROOT, '2020-01-01T00:00:00.000Z'),
      ],
      HERE,
    );
    expect(items.map((i) => i.id)).toEqual(['file:5', 'match:1', 'file:6']);
  });
});

describe('filterReplayItems and sourceCounts', () => {
  const items = buildReplayItems(
    [
      match(7, [70], { gameName: 'League final', players: ['alice', 'bob'] }),
      match(9, [90], { gameName: 'Practice', players: ['carol', 'dave'] }),
    ],
    [entry(2, 'replay_70.cor', 'replay', REPLAY_LIBRARY_ROOT, undefined, from(7, 70)), entry(3, 'draft night.cor')],
    HERE,
  );

  it('narrows to the server or to this device, where a saved match counts as local', () => {
    expect(filterReplayItems(items, 'server', '').map((i) => i.id)).toEqual(['match:7', 'match:9']);
    expect(filterReplayItems(items, 'local', '').map((i) => i.id)).toEqual(['match:7', 'file:3']);
    expect(sourceCounts(items)).toEqual({ all: 3, server: 2, local: 2 });
  });

  it('searches names, players, rooms and file names', () => {
    expect(filterReplayItems(items, 'all', 'CAROL').map((i) => i.id)).toEqual(['match:9']);
    expect(filterReplayItems(items, 'all', 'final').map((i) => i.id)).toEqual(['match:7']);
    expect(filterReplayItems(items, 'all', 'night').map((i) => i.id)).toEqual(['file:3']);
    expect(filterReplayItems(items, 'all', '  ')).toHaveLength(3);
  });
});

describe('day grouping', () => {
  const now = new Date(2026, 9, 10, 15, 0).getTime();

  it('buckets by calendar day relative to now', () => {
    expect(dayGroupOf(new Date(2026, 9, 10, 1, 0).getTime(), now)).toBe('today');
    expect(dayGroupOf(new Date(2026, 9, 9, 23, 0).getTime(), now)).toBe('yesterday');
    expect(dayGroupOf(new Date(2026, 9, 5, 12, 0).getTime(), now)).toBe('week');
    expect(dayGroupOf(new Date(2026, 9, 3, 12, 0).getTime(), now)).toBe('older');
  });

  it('returns only non-empty groups in display order', () => {
    const items = buildReplayItems(
      [
        match(1, [10], { timeStarted: Math.floor(new Date(2026, 9, 10, 9).getTime() / 1000) }),
        match(2, [20], { timeStarted: Math.floor(new Date(2026, 9, 1).getTime() / 1000) }),
      ],
      [entry(3, 'x.cor', 'replay', REPLAY_LIBRARY_ROOT, new Date(2026, 9, 9, 20).toISOString())],
      HERE,
    );
    expect(groupByDay(items, now).map((g) => [g.group, g.items.map((i) => i.id)])).toEqual([
      ['today', ['match:1']],
      ['yesterday', ['file:3']],
      ['older', ['match:2']],
    ]);
  });
});
