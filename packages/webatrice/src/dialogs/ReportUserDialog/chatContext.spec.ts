import { formatChatContext, MAX_CHAT_CONTEXT_MESSAGES } from './chatContext';

function at(hours: number, minutes: number, seconds: number): number {
  return new Date(2026, 0, 1, hours, minutes, seconds).getTime();
}

describe('formatChatContext', () => {
  it('formats each message as [hh:mm:ss] user: message in local time', () => {
    const log = formatChatContext([
      { userName: 'alice', message: 'hi', timeReceived: at(9, 5, 7) },
      { userName: 'mallory', message: 'go away', timeReceived: at(21, 30, 0) },
    ]);
    expect(log).toBe('[09:05:07] alice: hi\n[21:30:00] mallory: go away');
  });

  it('skips system lines with no sender or from Servatrice', () => {
    const log = formatChatContext([
      { userName: '', message: 'server notice', timeReceived: at(1, 0, 0) },
      { userName: 'Servatrice', message: 'maintenance', timeReceived: at(1, 0, 0) },
      { userName: 'alice', message: 'hi', timeReceived: at(1, 0, 0) },
    ]);
    expect(log).toBe('[01:00:00] alice: hi');
  });

  it('keeps only the newest messages, 50 by default', () => {
    const entries = Array.from({ length: 60 }, (_, i) => ({
      userName: 'u',
      message: `m${i}`,
      timeReceived: at(0, 0, 0),
    }));
    const lines = formatChatContext(entries).split('\n');
    expect(lines).toHaveLength(MAX_CHAT_CONTEXT_MESSAGES);
    expect(lines[0]).toContain('m10');
    expect(formatChatContext(entries, 2)).toBe('[00:00:00] u: m58\n[00:00:00] u: m59');
  });

  it('returns an empty string when there is nothing to attach', () => {
    expect(formatChatContext([])).toBe('');
  });
});
