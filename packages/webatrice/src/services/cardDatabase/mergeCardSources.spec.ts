import type { CardSourceRecords } from '@app/services';

import {
  mergeCardSources,
  nextCustomOrder,
  sortSourcesByLoadOrder,
  sourceIdFor,
  sourceKindForFile,
} from './mergeCardSources';

const layer = (overrides: Partial<CardSourceRecords>): CardSourceRecords => ({
  cards: [], sets: [], tokens: [], formats: [], ...overrides,
});

describe('mergeCardSources', () => {
  it('maps desktop file names to source kinds, case-insensitively', () => {
    expect(sourceKindForFile('cards.xml')).toBe('main');
    expect(sourceKindForFile('Tokens.XML')).toBe('tokens');
    expect(sourceKindForFile('spoiler.xml')).toBe('spoiler');
    expect(sourceKindForFile('my-cube.xml')).toBe('custom');
  });

  it('gives custom files a prefixed id and fixed ids to the rest', () => {
    expect(sourceIdFor('custom', 'cube.xml', 3)).toBe('custom:03:cube.xml');
    expect(sourceIdFor('main', 'cards.xml', 0)).toBe('main');
    expect(sourceIdFor('user-tokens', 'TK.xml', 0)).toBe('user-tokens');
  });

  it('orders sources like desktop loads them', () => {
    const sources = [
      { kind: 'user-tokens', order: 0, fileName: 'TK.xml' },
      { kind: 'custom', order: 2, fileName: 'b.xml' },
      { kind: 'spoiler', order: 0, fileName: 'spoiler.xml' },
      { kind: 'custom', order: 1, fileName: 'z.xml' },
      { kind: 'tokens', order: 0, fileName: 'tokens.xml' },
      { kind: 'main', order: 0, fileName: 'cards.xml' },
    ] as const;
    expect(sortSourcesByLoadOrder(sources).map((s) => s.fileName)).toEqual([
      'cards.xml', 'tokens.xml', 'spoiler.xml', 'z.xml', 'b.xml', 'TK.xml',
    ]);
  });

  it('numbers the next custom file one past the highest in use', () => {
    expect(nextCustomOrder([])).toBe(1);
    expect(nextCustomOrder([{ kind: 'custom', order: 4 }, { kind: 'main', order: 9 }])).toBe(5);
  });

  it('keeps the first definition of a card and appends new printings from later sources', () => {
    const merged = mergeCardSources([
      layer({ cards: [{ name: { value: 'Bolt' }, text: { value: 'main' }, set: { value: 'LEA', uuid: 'a' } }] }),
      layer({
        cards: [
          { name: { value: 'Bolt' }, text: { value: 'spoiler' }, set: [{ value: 'LEA', uuid: 'a' }, { value: 'NEW', uuid: 'b' }] },
          { name: { value: 'Fresh' }, set: { value: 'NEW' } },
        ],
      }),
    ]);

    expect(merged.cards).toEqual([
      { name: { value: 'Bolt' }, text: { value: 'main' }, set: [{ value: 'LEA', uuid: 'a' }, { value: 'NEW', uuid: 'b' }] },
      { name: { value: 'Fresh' }, set: { value: 'NEW' } },
    ]);
  });

  it('keeps first set metadata and info, but the last format on a case-insensitive key', () => {
    const info = { id: 'singleton' as const, source: 'oracle-local-fs' as const, importedAt: 'x', author: 'main' };
    const merged = mergeCardSources([
      layer({
        sets: [{ name: { value: 'NEO' }, longname: { value: 'Main' } }],
        formats: [{ formatName: 'Standard', minDeckSize: 60 }],
        info,
      }),
      layer({
        sets: [{ name: { value: 'NEO' }, longname: { value: 'Custom' } }, { name: { value: 'CUS' } }],
        formats: [{ formatName: 'STANDARD', minDeckSize: 40 }],
        info: { ...info, author: 'custom' },
      }),
    ]);

    expect(merged.sets.map((s) => s.longname?.value ?? s.name.value)).toEqual(['Main', 'CUS']);
    expect(merged.formats).toEqual([{ formatName: 'STANDARD', minDeckSize: 40 }]);
    expect(merged.info?.author).toBe('main');
  });

  it('includes printing-only sets in the inventory and prefers explicit metadata', () => {
    const merged = mergeCardSources([
      layer({ cards: [{ name: { value: 'Card' }, set: [{ value: 'IMPLICIT' }, { value: 'LATER' }] }] }),
      layer({
        tokens: [{ name: { value: 'Token' }, set: { value: 'TOKEN' } }],
        sets: [{ name: { value: 'LATER' }, longname: { value: 'Declared' } }],
      }),
    ]);
    expect(merged.sets).toEqual(expect.arrayContaining([
      { name: { value: 'IMPLICIT' } }, { name: { value: 'TOKEN' } }, { name: { value: 'LATER' }, longname: { value: 'Declared' } },
    ]));
    expect(merged.sets).toHaveLength(3);
  });

  it('deduplicates full printing records, including duplicates in the incoming source', () => {
    const original = { value: 'SET', uuid: 'id', num: '1', picurl: 'first', rarity: 'common' };
    const alternate = { ...original, picurl: 'second' };
    const rare = { ...original, rarity: 'rare' };
    const merged = mergeCardSources([
      layer({ cards: [{ name: { value: 'Card' }, set: original }] }),
      layer({ cards: [{ name: { value: 'Card' }, set: [original, alternate, alternate, rare] }] }),
    ]);
    expect(merged.cards[0].set).toEqual([original, alternate, rare]);
  });

  it('shares first-wins names across cards and tokens, retaining later printings', () => {
    const merged = mergeCardSources([
      layer({
        cards: [{ name: { value: 'Card first' }, set: { value: 'A' } }],
        tokens: [{ name: { value: 'Token first' }, token: { value: '1' }, set: { value: 'A' } }],
      }),
      layer({
        cards: [{ name: { value: 'Token first' }, set: { value: 'B' } }],
        tokens: [{ name: { value: 'Card first' }, token: { value: '1' }, set: { value: 'B' } }],
      }),
    ]);
    expect(merged.cards).toEqual([{ name: { value: 'Card first' }, set: [{ value: 'A' }, { value: 'B' }] }]);
    expect(merged.tokens).toEqual([{ name: { value: 'Token first' }, token: { value: '1' }, set: [{ value: 'A' }, { value: 'B' }] }]);
  });

  it('merges tokens separately from cards', () => {
    const merged = mergeCardSources([
      layer({ tokens: [{ name: { value: 'Goblin' } }] }),
      layer({ tokens: [{ name: { value: 'Goblin' } }, { name: { value: 'Elf' } }] }),
    ]);
    expect(merged.tokens.map((t) => t.name.value)).toEqual(['Goblin', 'Elf']);
    expect(merged.cards).toEqual([]);
  });
});
