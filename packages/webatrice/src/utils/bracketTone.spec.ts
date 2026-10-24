import { bracketToneClass } from './bracketTone';

describe('bracketToneClass', () => {
  it('maps levels to the shared palette with a neutral fallback', () => {
    expect(bracketToneClass(3)).toBe('text-warning bg-yellow-500/15 border-yellow-500/40');
    expect(bracketToneClass(9)).toBe('text-text-secondary bg-bg-elevated border-border-subtle');
  });
});
