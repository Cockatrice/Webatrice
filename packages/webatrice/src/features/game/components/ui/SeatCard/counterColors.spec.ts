import { COUNTER_TYPE_COUNT, COUNTER_TYPE_LABELS, counterColorForId } from './counterColors';

describe('counterColors', () => {
  it('exposes 6 type labels (Cockatrice parity)', () => {
    expect(COUNTER_TYPE_COUNT).toBe(6);
    expect(COUNTER_TYPE_LABELS).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('produces a distinct colour per id 0-5', () => {
    const colors = new Set<string>();
    for (let i = 0; i < COUNTER_TYPE_COUNT; i++) {
      colors.add(counterColorForId(i));
    }
    expect(colors.size).toBe(COUNTER_TYPE_COUNT);
  });

  it('reads the counter\'s colour from Appearance › Card counters, with desktop\'s default', () => {
    expect(counterColorForId(0)).toBe('var(--card-counter-0, #FF6969)');
    expect(counterColorForId(1)).toBe('var(--card-counter-1, #FFFF69)');
    expect(counterColorForId(5)).toBe('var(--card-counter-5, #FF69FF)');
  });

  it('wraps past id 6 so out-of-range ids stay valid CSS', () => {
    expect(counterColorForId(6)).toBe('var(--card-counter-0, #FF6969)');
    expect(counterColorForId(7)).toBe('var(--card-counter-1, #FFFF69)');
  });
});
