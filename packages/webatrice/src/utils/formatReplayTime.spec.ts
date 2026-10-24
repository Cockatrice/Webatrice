import { formatReplayTime } from './formatReplayTime';

describe('formatReplayTime', () => {
  it('formats minutes and seconds, flooring partial seconds', () => {
    expect(formatReplayTime(0)).toBe('0:00');
    expect(formatReplayTime(65999)).toBe('1:05');
  });

  it('adds hours for long games', () => {
    expect(formatReplayTime(3_725_000)).toBe('1:02:05');
  });

  it('never shows a negative time', () => {
    expect(formatReplayTime(-500)).toBe('0:00');
  });
});
