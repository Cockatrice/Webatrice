import { logRowKey } from './logRowKey';

describe('logRowKey', () => {
  it('gives a line the same key every time', () => {
    const line = { message: 'a' };
    expect(logRowKey(line)).toBe(logRowKey(line));
  });

  it('gives equal-looking lines their own keys', () => {
    expect(logRowKey({ message: 'a' })).not.toBe(logRowKey({ message: 'a' }));
  });

  it('keeps a line\'s key when the lines before it are trimmed', () => {
    const lines = [{ message: 'a' }, { message: 'b' }, { message: 'c' }];
    const before = lines.map(logRowKey);
    expect(lines.slice(1).map(logRowKey)).toEqual(before.slice(1));
  });
});
