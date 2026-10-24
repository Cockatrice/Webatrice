import {
  accountAgeDays,
  formatReportDate,
  formatReportTime,
  parseChatLog,
  reportAge,
  reportCategorySeverity,
  reportStatusTone,
  weekChange,
} from './reportFormat';

describe('accountAgeDays', () => {
  it('counts whole days since registration and never goes negative', () => {
    const now = 1_800_000_000_000;
    expect(accountAgeDays(BigInt(now / 1000 - 41 * 86_400 - 5), now)).toBe(41);
    expect(accountAgeDays(BigInt(now / 1000 + 100), now)).toBe(0);
  });
});

describe('formatReportTime', () => {
  it('formats epoch seconds as local yyyy-MM-dd hh:mm', () => {
    const seconds = BigInt(new Date(2026, 7, 21, 9, 5, 59).getTime() / 1000);
    expect(formatReportTime(seconds)).toBe('2026-08-21 09:05');
    expect(formatReportDate(seconds)).toBe('2026-08-21');
  });
});

describe('reportStatusTone', () => {
  it('gives each known status its tone and leaves others neutral', () => {
    expect(reportStatusTone('open')).toBe('warning');
    expect(reportStatusTone('assigned')).toBe('info');
    expect(reportStatusTone('resolved')).toBe('success');
    expect(reportStatusTone('dismissed')).toBe('neutral');
    expect(reportStatusTone('escalated')).toBe('neutral');
  });
});

describe('reportCategorySeverity', () => {
  it.each([
    ['hate_speech', 'severe'], ['harassment', 'severe'], ['verbal_abuse', 'severe'],
    ['cheating', 'play'], ['bug_abuse', 'play'], ['spam', 'other'], ['griefing', 'other'],
  ])('%s is %s', (category, severity) => {
    expect(reportCategorySeverity(category)).toBe(severity);
  });
});

describe('reportAge', () => {
  const now = 1_800_000_000_000;
  const ago = (minutes: number) => BigInt(now / 1000 - minutes * 60);

  it('counts minutes under an hour, hours under a day, then days', () => {
    expect(reportAge(ago(6), now)).toEqual({ unit: 'minutes', count: 6 });
    expect(reportAge(ago(59), now)).toEqual({ unit: 'minutes', count: 59 });
    expect(reportAge(ago(60), now)).toEqual({ unit: 'hours', count: 1 });
    expect(reportAge(ago(1439), now)).toEqual({ unit: 'hours', count: 23 });
    expect(reportAge(ago(1440 * 3 + 5), now)).toEqual({ unit: 'days', count: 3 });
  });

  it('never goes negative when the server clock is ahead', () => {
    expect(reportAge(ago(-5), now)).toEqual({ unit: 'minutes', count: 0 });
  });
});

describe('parseChatLog', () => {
  it('splits the reporter client lines into time, sender and text', () => {
    expect(parseChatLog('[20:31] Medomai: go for it\n[20:31:05] TiltedTurbo: no: never\n')).toEqual([
      { time: '20:31', from: 'Medomai', text: 'go for it' },
      { time: '20:31:05', from: 'TiltedTurbo', text: 'no: never' },
    ]);
  });

  it('keeps lines it cannot read as plain text', () => {
    expect(parseChatLog('free text\r\n\r\n[x] y')).toEqual([
      { time: '', from: '', text: 'free text' },
      { time: '', from: '', text: '[x] y' },
    ]);
  });
});

describe('weekChange', () => {
  it('gives the percentage change, or null for a week that is new', () => {
    expect(weekChange(3, 2)).toBe(50);
    expect(weekChange(1, 4)).toBe(-75);
    expect(weekChange(3, 0)).toBeNull();
    expect(weekChange(0, 0)).toBe(0);
  });
});
