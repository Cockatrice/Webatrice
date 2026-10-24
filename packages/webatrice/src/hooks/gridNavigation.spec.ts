import { isSelectKey, navigationTarget } from './gridNavigation';

describe('navigationTarget', () => {
  it('moves one row with the arrows and stops at the ends', () => {
    expect(navigationTarget('ArrowDown', 1, 3)).toBe(2);
    expect(navigationTarget('ArrowDown', 2, 3)).toBe(2);
    expect(navigationTarget('ArrowUp', 1, 3)).toBe(0);
    expect(navigationTarget('ArrowUp', 0, 3)).toBe(0);
  });

  it('jumps with Home, End and the page keys', () => {
    expect(navigationTarget('Home', 7, 30)).toBe(0);
    expect(navigationTarget('End', 7, 30)).toBe(29);
    expect(navigationTarget('PageDown', 7, 30)).toBe(17);
    expect(navigationTarget('PageDown', 25, 30)).toBe(29);
    expect(navigationTarget('PageUp', 7, 30)).toBe(0);
  });

  it('starts at the first row when none is current, and ignores other keys', () => {
    expect(navigationTarget('ArrowDown', null, 3)).toBe(0);
    expect(navigationTarget('ArrowUp', null, 3)).toBe(0);
    expect(navigationTarget('a', 1, 3)).toBeNull();
    expect(navigationTarget('ArrowDown', null, 0)).toBeNull();
  });

  it('treats Space and Enter as select', () => {
    expect(isSelectKey(' ')).toBe(true);
    expect(isSelectKey('Enter')).toBe(true);
    expect(isSelectKey('Tab')).toBe(false);
  });
});
