import type { BracketSignals } from './bracket';
import { bracketSignalBadges } from './bracketBadges';

function signals(overrides: Partial<BracketSignals> = {}): BracketSignals {
  return {
    turns: { matches: [], restricted: [] },
    denial: { matches: [], restricted: [] },
    gameChangers: { matches: [] },
    earlyCombos: [],
    lateCombos: [],
    ...overrides,
  };
}

describe('bracketSignalBadges', () => {
  it('renders every badge muted for a clean deck', () => {
    const badges = bracketSignalBadges(signals());
    expect(badges.map((b) => [b.id, b.count, b.tone])).toEqual([
      ['gameChangers', 0, 'muted'],
      ['denial', 0, 'muted'],
      ['turns', 0, 'muted'],
      ['earlyCombos', 0, 'muted'],
      ['lateCombos', 0, 'muted'],
    ]);
  });

  it('applies the warn and hot thresholds', () => {
    const combo = { id: 'c', cardNames: ['A', 'B'], totalMana: 4 };
    const badges = bracketSignalBadges(signals({
      gameChangers: { matches: ['G1', 'G2', 'G3', 'G4'] },
      turns: { matches: ['T1', 'T2', 'T3'], restricted: [] },
      denial: { matches: [], restricted: ['Armageddon'] },
      earlyCombos: [combo],
      lateCombos: [combo],
    }));
    expect(badges.map((b) => b.tone)).toEqual(['hot', 'hot', 'warn', 'hot', 'warn']);
    expect(badges[1].items).toEqual(['Armageddon']);
    expect(badges[3].items).toEqual(['A + B']);
  });

  it('lists chain-able extra turns apart from the others and treats them as hot', () => {
    const [, , turns] = bracketSignalBadges(signals({
      turns: { matches: ['Time Warp'], restricted: ['Nexus of Fate'] },
    }));
    expect(turns.tone).toBe('hot');
    expect(turns.count).toBe(1);
    expect(turns.items).toEqual(['Time Warp']);
    expect(turns.chainable).toEqual(['Nexus of Fate']);
  });
});
