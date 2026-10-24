import { staffTabIds, tabKeyTarget } from './staffTabs';

describe('tabKeyTarget', () => {
  it('moves with the arrows, wrapping at both ends, and jumps with Home and End', () => {
    expect(tabKeyTarget('ArrowRight', 0, 3)).toBe(1);
    expect(tabKeyTarget('ArrowRight', 2, 3)).toBe(0);
    expect(tabKeyTarget('ArrowLeft', 0, 3)).toBe(2);
    expect(tabKeyTarget('Home', 2, 3)).toBe(0);
    expect(tabKeyTarget('End', 0, 3)).toBe(2);
  });

  it('ignores other keys', () => {
    expect(tabKeyTarget('Enter', 1, 3)).toBeNull();
    expect(tabKeyTarget('ArrowDown', 1, 3)).toBeNull();
  });
});

describe('staffTabIds', () => {
  it('ties each tab to the one panel', () => {
    expect(staffTabIds('logs', 'game')).toEqual({ tab: 'logs-tab-game', panel: 'logs-panel' });
  });
});
