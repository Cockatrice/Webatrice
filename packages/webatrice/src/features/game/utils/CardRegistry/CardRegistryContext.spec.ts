import { describe, expect, it } from 'vitest';

import { makeCardKey, parseCardKey } from './CardRegistryContext';

describe('parseCardKey', () => {
  it('round-trips makeCardKey', () => {
    expect(parseCardKey(makeCardKey(3, 'table', 42))).toEqual({
      playerId: 3,
      zone: 'table',
      cardId: 42,
    });
  });

  it('preserves a hyphenated zone in the middle segment', () => {
    expect(parseCardKey('0-some-zone-7')).toEqual({
      playerId: 0,
      zone: 'some-zone',
      cardId: 7,
    });
  });

  it('returns null for a player key', () => {
    expect(parseCardKey('player:2')).toBeNull();
  });

  it('returns null when there is no zone segment', () => {
    expect(parseCardKey('5-9')).toBeNull();
  });
});
