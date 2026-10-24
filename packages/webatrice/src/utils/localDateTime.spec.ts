import { formatLocalDateTime } from './localDateTime';

describe('formatLocalDateTime', () => {
  it('formats local time as yyyy-MM-dd HH:mm with zero padding', () => {
    expect(formatLocalDateTime(new Date(2024, 0, 5, 7, 3))).toBe('2024-01-05 07:03');
    expect(formatLocalDateTime(new Date(2024, 11, 31, 23, 59, 59))).toBe('2024-12-31 23:59');
  });
});
