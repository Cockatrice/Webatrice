import type { Card } from '../../dexie';
import type { CardDataPreferences } from '../../cardDatabase';
import { dexieToLookup } from './dexieCardMapper';

function xmlCard(overrides: Partial<Record<string, unknown>> = {}): Card {
  return {
    name: { value: 'Swan Song' },
    prop: {
      value: {
        type: { value: 'Instant' },
        manacost: { value: ' U ' },
        cmc: { value: '1' },
        coloridentity: { value: 'u' },
        'format-legacy': { value: 'legal' },
      },
    },
    set: { value: 'THS', num: '65', uuid: '0f1a2b3c-0000-4000-8000-000000000001' },
    related: { value: 'Bird', count: '1' },
    'reverse-related': [{ value: 'Bird' }, { value: 'Swan' }],
    ...overrides,
  } as unknown as Card;
}

describe('dexieToLookup', () => {
  it('reads trimmed props, colors from the color identity, and format legalities', () => {
    expect(dexieToLookup(xmlCard())).toMatchObject({
      found: true,
      source: 'dexie',
      colorIdentity: ['U'],
      name: 'Swan Song',
      typeLine: 'Instant',
      manaCost: 'U',
      cmc: 1,
      colors: ['U'],
      legalities: { legacy: 'legal' },
      properties: { type: 'Instant', manacost: ' U ', cmc: '1', coloridentity: 'u', 'format-legacy': 'legal' },
    });
  });

  it('reads a collapsed single <related> and dedupes reverse relations by name', () => {
    expect(dexieToLookup(xmlCard()).related).toEqual([
      { name: 'Bird', count: '1', attach: undefined, persistent: undefined, origin: 'related' },
      { name: 'Swan', count: undefined, attach: undefined, persistent: undefined, origin: 'reverse-related' },
    ]);
  });

  it('without preferences, images a printing by picurl, then picURL, then its Scryfall id', () => {
    const sets = [
      { value: 'A', picurl: 'https://mirror/a.jpg' },
      { value: 'B', picURL: 'https://mirror/b.jpg' },
      { value: 'C', uuid: '0f1a2b3c-0000-4000-8000-000000000001' },
      { value: '' },
    ];
    expect(dexieToLookup(xmlCard({ set: sets })).printings.map((p) => [p.set, p.imageUri])).toEqual([
      ['A', 'https://mirror/a.jpg'],
      ['B', 'https://mirror/b.jpg'],
      ['C', 'https://api.scryfall.com/cards/0f1a2b3c-0000-4000-8000-000000000001?format=image&version=small'],
      [undefined, undefined],
    ]);
  });

  it('orders enabled sets by user preference and keeps every image candidate', () => {
    const preferences: CardDataPreferences = {
      setPreferences: new Map([
        ['OLD', { code: 'OLD', sortKey: 0, enabled: false, isKnown: true }],
        ['NEW', { code: 'NEW', sortKey: 1, enabled: true, isKnown: true }],
      ]),
      setLongNames: new Map(),
      pictureUrlTemplates: [
        'https://first.example/!setcode!/!set:uuid!.jpg',
        'https://second.example/!setcode!/!set:uuid!.jpg',
      ],
    };
    const result = dexieToLookup(xmlCard({
      set: [
        { value: 'OLD', uuid: 'old-id' },
        { value: 'NEW', uuid: 'new-id', picurl: 'https://mirror.example/new.jpg' },
      ],
    }), preferences);

    expect(result.printings.map((printing) => printing.set)).toEqual(['NEW', 'OLD']);
    expect(result.printings[0].imageUris).toEqual([
      'https://mirror.example/new.jpg',
      'https://first.example/NEW/new-id.jpg',
      'https://second.example/NEW/new-id.jpg',
      'https://api.scryfall.com/cards/new-id?format=image&version=small',
    ]);
    expect(result.printings[0].imageUri).toBe('https://mirror.example/new.jpg');
  });

  it('has no legality, related or printing data when cards.xml carries none', () => {
    const result = dexieToLookup(xmlCard({
      prop: { value: { cmc: { value: 'x' } } },
      set: undefined,
      related: undefined,
      'reverse-related': undefined,
    }));
    expect(result).toMatchObject({
      cmc: undefined, colors: undefined, colorIdentity: undefined, legalities: undefined, related: undefined, printings: [],
    });
    expect(dexieToLookup(xmlCard({ prop: { value: { coloridentity: { value: '' } } } })))
      .toMatchObject({ colors: undefined, colorIdentity: [] });
  });
});
