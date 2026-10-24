import { COMMANDER_FORMATS, MTG_FORMATS, MTG_FORMAT_LABELS, isCommanderFormat, isMtgFormat, normalizeFormat } from './deckFormat';
import type { TFunction } from 'i18next';

describe('deck formats', () => {
  it('translates labels on demand while preserving stored format slugs', () => {
    const first = ((key: string) => `first:${key}`) as unknown as TFunction;
    const second = ((key: string) => `second:${key}`) as unknown as TFunction;
    const commander = MTG_FORMAT_LABELS.find((format) => format.value === 'commander')!;
    expect(commander.label(first)).toBe('first:DeckFormat.commander');
    expect(commander.label(second)).toBe('second:DeckFormat.commander');
    expect(commander.value).toBe('commander');
  });
  it('derives the value list from the labelled list, commander family first', () => {
    expect(MTG_FORMATS).toEqual(MTG_FORMAT_LABELS.map((f) => f.value));
    expect(MTG_FORMATS.slice(0, 2)).toEqual([...COMMANDER_FORMATS]);
  });

  it.each([
    [undefined, ''],
    [null, ''],
    ['  Commander ', 'commander'],
    ['PAUPER', 'pauper'],
    ['My Cube', 'my cube'],
  ])('normalizeFormat(%j) → %j', (input, expected) => {
    expect(normalizeFormat(input)).toBe(expected);
  });

  it.each([
    ['commander', true, true],
    [' PauperCommander', true, true],
    ['Modern', true, false],
    ['duel', true, false],
    ['', false, false],
    ['cube', false, false],
  ])('%j: MTG %s, commander %s', (format, mtg, commander) => {
    expect(isMtgFormat(format)).toBe(mtg);
    expect(isCommanderFormat(format)).toBe(commander);
  });
});
