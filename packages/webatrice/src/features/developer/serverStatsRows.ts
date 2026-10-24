import type { TFunction } from 'i18next';

import type { CommandStats, Response_GetServerStats } from '@cockatrice/sockatrice/generated';

import { formatLocalDateTime } from '@app/utils';

export interface StatRow {
  label: string;
  value: string;
  section?: boolean;
}

export interface CommandRow {
  name: string;
  count: string;
  totalMs: string;
  avgMs: string;
}

const KIB = 1024;
const MIB = 1024 * KIB;
const GIB = 1024 * MIB;

export function formatBytes(bytes: bigint, t: TFunction): string {
  const value = Number(bytes);
  if (value >= GIB) {
    return t('Developer.unit.gib', { value: (value / GIB).toFixed(2) });
  }
  if (value >= MIB) {
    return t('Developer.unit.mib', { value: (value / MIB).toFixed(2) });
  }
  if (value >= KIB) {
    return t('Developer.unit.kib', { value: (value / KIB).toFixed(2) });
  }
  return t('Developer.unit.bytes', { value });
}

export function formatDurationMs(ms: bigint, t: TFunction): string {
  const value = Number(ms);
  if (value >= 1000) {
    return t('Developer.unit.seconds', { value: (value / 1000).toFixed(2) });
  }
  return t('Developer.unit.milliseconds', { value });
}

export function buildStatRows(stats: Response_GetServerStats, t: TFunction): StatRow[] {
  const uptime = Number(stats.uptimeSecs);
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  const rows: StatRow[] = [
    { label: t('Developer.stat.usersOnline'), value: String(stats.usersCount) },
    { label: t('Developer.stat.modsOnline'), value: String(stats.modsCount) },
    { label: t('Developer.stat.gamesRunning'), value: String(stats.gamesCount) },
    { label: t('Developer.stat.trafficSent'), value: formatBytes(stats.txBytes, t) },
    { label: t('Developer.stat.trafficReceived'), value: formatBytes(stats.rxBytes, t) },
    {
      label: t('Developer.stat.uptime'),
      value: days > 0
        ? t('Developer.unit.uptimeDays', { days, hours, minutes })
        : t('Developer.unit.uptimeHours', { hours, minutes }),
    },
    { label: t('Developer.stat.snapshot'), value: formatLocalDateTime(new Date(Number(stats.timest) * 1000)) },
    { label: t('Developer.stat.liveMetrics'), value: '', section: true },
    { label: t('Developer.stat.cardsInGames'), value: String(stats.cardsInGames) },
    { label: t('Developer.stat.totalCommands'), value: String(stats.totalCommands) },
  ];

  if (stats.totalCommands > 0n) {
    const avg = Number(stats.totalCommandTimeMs) / Number(stats.totalCommands);
    rows.push({ label: t('Developer.stat.avgCommandTime'), value: t('Developer.unit.milliseconds', { value: avg.toFixed(2) }) });
  }
  rows.push(
    { label: t('Developer.stat.activeCommandTypes'), value: String(stats.activeCommandTypes) },
    { label: t('Developer.stat.stalls'), value: String(stats.eventloopStallsTotal) },
    { label: t('Developer.stat.lastStall'), value: formatDurationMs(stats.eventloopLastStallMs, t) },
    { label: t('Developer.stat.worstStall'), value: formatDurationMs(stats.eventloopMaxStallMs, t) },
  );

  if (stats.gameStartCount > 0n) {
    const avgStart = Number(stats.gameStartTotalMs) / Number(stats.gameStartCount);
    rows.push(
      { label: t('Developer.stat.gameStarts'), value: String(stats.gameStartCount) },
      { label: t('Developer.stat.avgGameStart'), value: t('Developer.unit.milliseconds', { value: avgStart.toFixed(1) }) },
    );
  }
  return rows;
}

export function buildCommandRows(commandStats: CommandStats[]): CommandRow[] {
  return [...commandStats]
    .sort((a, b) => (b.totalMs > a.totalMs ? 1 : b.totalMs < a.totalMs ? -1 : 0))
    .map((cs) => {
      const count = Number(cs.count);
      const avg = count > 0 ? Number(cs.totalMs) / count : 0;
      return { name: cs.commandName, count: String(cs.count), totalMs: String(cs.totalMs), avgMs: avg.toFixed(2) };
    });
}
