import { COUNTER_TYPE_COUNT, COUNTER_TYPE_LABELS, counterColorForId } from './counterColors';

describe('counterColors', () => {
  it('exposes 6 type labels (Cockatrice parity)', () => {
    expect(COUNTER_TYPE_COUNT).toBe(6);
    expect(COUNTER_TYPE_LABELS).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('produces a distinct hue per id 0-5', () => {
    const colors = new Set<string>();
    for (let i = 0; i < COUNTER_TYPE_COUNT; i++) {
      colors.add(counterColorForId(i));
    }
    expect(colors.size).toBe(COUNTER_TYPE_COUNT);
  });

  it('emits a parseable hsl() string anchored at id × 60°', () => {
    expect(counterColorForId(0)).toBe('hsl(0, 59%, 70%)');
    expect(counterColorForId(1)).toBe('hsl(60, 59%, 70%)');
    expect(counterColorForId(5)).toBe('hsl(300, 59%, 70%)');
  });

  it('wraps hue past id 6 so out-of-range ids stay valid CSS', () => {
    expect(counterColorForId(6)).toBe('hsl(0, 59%, 70%)');
    expect(counterColorForId(7)).toBe('hsl(60, 59%, 70%)');
  });
});
