import { create } from '@bufbuild/protobuf';
import type { TFunction } from 'i18next';

import { CommandStatsSchema, Response_GetServerStatsSchema } from '@cockatrice/sockatrice/generated';

import { buildCommandRows, buildStatRows, formatBytes, formatDurationMs } from './serverStatsRows';

const t = ((key: string, values?: Record<string, unknown>) =>
  (values ? `${key}:${JSON.stringify(values)}` : key)) as unknown as TFunction;

describe('formatBytes / formatDurationMs (desktop TabDeveloper)', () => {
  it('picks the largest binary unit with two decimals', () => {
    expect(formatBytes(512n, t)).toBe('Developer.unit.bytes:{"value":512}');
    expect(formatBytes(1536n, t)).toBe('Developer.unit.kib:{"value":"1.50"}');
    expect(formatBytes(BigInt(3 * 1024 * 1024), t)).toBe('Developer.unit.mib:{"value":"3.00"}');
    expect(formatBytes(BigInt(2 * 1024 ** 3), t)).toBe('Developer.unit.gib:{"value":"2.00"}');
  });

  it('switches to seconds from 1000 ms', () => {
    expect(formatDurationMs(999n, t)).toBe('Developer.unit.milliseconds:{"value":999}');
    expect(formatDurationMs(1500n, t)).toBe('Developer.unit.seconds:{"value":"1.50"}');
  });
});

describe('buildStatRows', () => {
  it('lists the overview, then a Live Metrics section, with optional averages', () => {
    const stats = create(Response_GetServerStatsSchema, {
      usersCount: 10n,
      uptimeSecs: BigInt(2 * 86400 + 3 * 3600 + 4 * 60),
      totalCommands: 4n,
      totalCommandTimeMs: 10n,
      gameStartCount: 0n,
    });
    const rows = buildStatRows(stats, t);
    const labels = rows.map((row) => row.label);

    expect(rows[0]).toEqual({ label: 'Developer.stat.usersOnline', value: '10' });
    expect(rows.find((row) => row.label === 'Developer.stat.uptime')?.value)
      .toBe('Developer.unit.uptimeDays:{"days":2,"hours":3,"minutes":4}');
    expect(rows.find((row) => row.label === 'Developer.stat.liveMetrics')?.section).toBe(true);
    expect(rows.find((row) => row.label === 'Developer.stat.avgCommandTime')?.value).toBe('Developer.unit.milliseconds:{"value":"2.50"}');
    expect(labels).not.toContain('Developer.stat.gameStarts');
  });

  it('omits the command average when nothing was processed and shows short uptimes in hours', () => {
    const rows = buildStatRows(create(Response_GetServerStatsSchema, { uptimeSecs: 3700n, gameStartCount: 2n, gameStartTotalMs: 5n }), t);
    expect(rows.map((row) => row.label)).not.toContain('Developer.stat.avgCommandTime');
    expect(rows.find((row) => row.label === 'Developer.stat.uptime')?.value).toBe('Developer.unit.uptimeHours:{"hours":1,"minutes":1}');
    expect(rows.find((row) => row.label === 'Developer.stat.avgGameStart')?.value).toBe('Developer.unit.milliseconds:{"value":"2.5"}');
  });
});

describe('buildCommandRows', () => {
  it('sorts by total time, slowest first, with a per-call average', () => {
    const rows = buildCommandRows([
      create(CommandStatsSchema, { commandName: 'session/Command_Ping', count: 100n, totalMs: 50n }),
      create(CommandStatsSchema, { commandName: 'game/Command_MoveCard', count: 4n, totalMs: 200n }),
      create(CommandStatsSchema, { commandName: 'room/Command_Idle', count: 0n, totalMs: 0n }),
    ]);
    expect(rows.map((row) => row.name)).toEqual(['game/Command_MoveCard', 'session/Command_Ping', 'room/Command_Idle']);
    expect(rows[0]).toEqual({ name: 'game/Command_MoveCard', count: '4', totalMs: '200', avgMs: '50.00' });
    expect(rows[2].avgMs).toBe('0.00');
  });
});
