import { clipState } from './useClippedContent';

describe('clipState', () => {
  it('is clipped only when the content is taller than the space it has', () => {
    expect(clipState({ content: 300, viewport: 300, frame: 360 }, 140).clipped).toBe(false);
    expect(clipState({ content: 301, viewport: 300, frame: 360 }, 140).clipped).toBe(false);
    expect(clipState({ content: 420, viewport: 300, frame: 360 }, 140).clipped).toBe(true);
  });

  it('lets the frame shrink to its chrome plus a short message, or the minimum visible part of a long one', () => {
    expect(clipState({ content: 90, viewport: 90, frame: 150 }, 140).frameMinHeight).toBe(150);
    expect(clipState({ content: 900, viewport: 300, frame: 396 }, 140).frameMinHeight).toBe(236);
  });
});
