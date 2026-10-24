import { ReportStatus } from '@cockatrice/datatrice';

import type { ChipTone } from '@app/components';
import { formatLocalDateTime } from '@app/utils';

export function formatReportTime(secondsSinceEpoch: bigint): string {
  return formatLocalDateTime(new Date(Number(secondsSinceEpoch) * 1000));
}

export function formatReportDate(secondsSinceEpoch: bigint): string {
  return formatReportTime(secondsSinceEpoch).slice(0, 10);
}

export function reportStatusTone(status: string): ChipTone {
  switch (status) {
    case ReportStatus.OPEN:
      return 'warning';
    case ReportStatus.ASSIGNED:
      return 'info';
    case ReportStatus.RESOLVED:
      return 'success';
    default:
      return 'neutral';
  }
}

export type ReportCategorySeverity = 'severe' | 'play' | 'other';

const SEVERE_CATEGORIES = new Set(['hate_speech', 'harassment', 'verbal_abuse']);
const PLAY_CATEGORIES = new Set(['cheating', 'bug_abuse']);

export function reportCategorySeverity(category: string): ReportCategorySeverity {
  if (SEVERE_CATEGORIES.has(category)) {
    return 'severe';
  }
  return PLAY_CATEGORIES.has(category) ? 'play' : 'other';
}

export type ReportAgeUnit = 'minutes' | 'hours' | 'days';

export interface ReportAge {
  unit: ReportAgeUnit;
  count: number;
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

export function reportAge(secondsSinceEpoch: bigint, nowMs: number): ReportAge {
  const minutes = Math.max(0, Math.floor((nowMs / 1000 - Number(secondsSinceEpoch)) / 60));
  if (minutes < MINUTES_PER_HOUR) {
    return { unit: 'minutes', count: minutes };
  }
  if (minutes < MINUTES_PER_DAY) {
    return { unit: 'hours', count: Math.floor(minutes / MINUTES_PER_HOUR) };
  }
  return { unit: 'days', count: Math.floor(minutes / MINUTES_PER_DAY) };
}

export function weekChange(thisWeek: number, lastWeek: number): number | null {
  if (lastWeek > 0) {
    return Math.round(((thisWeek - lastWeek) * 100) / lastWeek);
  }
  return thisWeek > 0 ? null : 0;
}

const SECONDS_PER_DAY = 86_400;

export function accountAgeDays(registrationTime: bigint, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs / 1000 - Number(registrationTime)) / SECONDS_PER_DAY));
}

export interface ChatLogLine {
  time: string;
  from: string;
  text: string;
}

const CHAT_LINE = /^\[([^\]]*)\]\s*([^:]+):\s?(.*)$/;

export function parseChatLog(chatLog: string): ChatLogLine[] {
  return chatLog
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const match = CHAT_LINE.exec(line);
      return match ? { time: match[1], from: match[2].trim(), text: match[3] } : { time: '', from: '', text: line };
    });
}
