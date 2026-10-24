import { formatChatHistoryTime } from './chatTime';

describe('formatChatHistoryTime', () => {
  it('formats local time as d MMM yyyy HH:mm:ss', () => {
    expect(formatChatHistoryTime(new Date(2026, 9, 3, 9, 5, 7).getTime())).toBe('3 Oct 2026 09:05:07');
  });

  it('does not pad the day and uses a 24-hour clock', () => {
    expect(formatChatHistoryTime(new Date(2025, 0, 21, 23, 59, 0).getTime())).toBe('21 Jan 2025 23:59:00');
  });
});
