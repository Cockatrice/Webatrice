import { emptyCod, parseCod, serializeCod } from './cod';
import { defaultMeta, serializeMeta } from './meta';
import type { DeckCard, DeckMeta } from './types';

describe('parseCod', () => {
  it('parses deck name, main + side zones, and a mix of card forms', () => {
    const xml = `<?xml version="1.0"?>
<cockatrice_deck version="1">
  <deckname>Sample</deckname>
  <comments></comments>
  <zone name="main">
    <card number="4" name="Sol Ring"/>
    <card number="1">Lightning Bolt</card>
    <card number="2" name="Naturalize" set="C21" num="203" uuid="abc-123"/>
  </zone>
  <zone name="side">
    <card number="1" name="Force of Will"/>
  </zone>
</cockatrice_deck>`;

    const deck = parseCod(xml);
    expect(deck.name).toBe('Sample');
    expect(deck.cards).toHaveLength(4);

    expect(deck.cards[0]).toEqual({ name: 'Sol Ring', quantity: 4, category: 'main' });
    expect(deck.cards[1]).toEqual({ name: 'Lightning Bolt', quantity: 1, category: 'main' });
    expect(deck.cards[2]).toEqual({
      name: 'Naturalize',
      quantity: 2,
      category: 'main',
      set: 'C21',
      collectorNumber: '203',
      scryfallId: 'abc-123',
    });
    expect(deck.cards[3]).toEqual({ name: 'Force of Will', quantity: 1, category: 'sideboard' });
  });

  it('recognizes a commander zone', () => {
    const xml = `<?xml version="1.0"?>
<cockatrice_deck version="1">
  <deckname>Cmdr</deckname>
  <comments></comments>
  <zone name="commander"><card number="1" name="Zur the Enchanter"/></zone>
</cockatrice_deck>`;
    const deck = parseCod(xml);
    expect(deck.cards[0].category).toBe('commander');
  });

  it('defaults quantity to 1 when the number attribute is missing', () => {
    const xml = `<?xml version="1.0"?>
<cockatrice_deck version="1">
  <deckname>X</deckname><comments></comments>
  <zone name="main"><card name="Sol Ring"/></zone>
</cockatrice_deck>`;
    expect(parseCod(xml).cards[0].quantity).toBe(1);
  });

  it('extracts meta from the comments JSON blob', () => {
    const meta: DeckMeta = { v: 1, updatedAt: '2026-07-19T12:00:00Z', priceUsd: 42.5 };
    const xml = `<?xml version="1.0"?>
<cockatrice_deck version="1">
  <deckname>X</deckname>
  <comments>${serializeMeta(meta)}</comments>
</cockatrice_deck>`;
    const deck = parseCod(xml);
    expect(deck.meta.updatedAt).toBe('2026-07-19T12:00:00Z');
    expect(deck.meta.priceUsd).toBe(42.5);
  });

  it('preserves human-authored comments as `description`', () => {
    const xml = `<?xml version="1.0"?>
<cockatrice_deck version="1">
  <deckname>X</deckname>
  <comments>Notes about this deck.</comments>
</cockatrice_deck>`;
    expect(parseCod(xml).meta.description).toBe('Notes about this deck.');
  });

  it('throws on malformed XML', () => {
    expect(() => parseCod('<not-really-xml')).toThrow();
  });

  it('throws when the root element is wrong', () => {
    expect(() => parseCod('<not_cockatrice/>')).toThrow(/cockatrice_deck/);
  });
});

describe('serializeCod → parseCod round-trip', () => {
  it('round-trips a hydrated deck (name, cards, categories, printings, meta)', () => {
    const cards: DeckCard[] = [
      {
        name: 'Sol Ring',
        quantity: 4,
        category: 'main',
        set: 'C21',
        collectorNumber: '203',
        scryfallId: 'abc-123',
        lookupSource: 'dexie',
      },
      { name: 'Lightning Bolt', quantity: 1, category: 'main', lookupSource: 'dexie' },
      { name: 'Force of Will', quantity: 1, category: 'sideboard', lookupSource: 'dexie' },
      { name: 'Zur the Enchanter', quantity: 1, category: 'commander', lookupSource: 'dexie' },
    ];
    const meta: DeckMeta = {
      v: 1,
      updatedAt: '2026-07-19T00:00:00.000Z',
      description: 'Test deck',
      priceUsd: 12.34,
    };
    const xml = serializeCod({ name: 'Round Trip', meta, cards });

    const parsed = parseCod(xml);
    expect(parsed.name).toBe('Round Trip');
    expect(parsed.cards).toEqual([
      {
        name: 'Sol Ring',
        quantity: 4,
        category: 'main',
        set: 'C21',
        collectorNumber: '203',
        scryfallId: 'abc-123',
      },
      { name: 'Lightning Bolt', quantity: 1, category: 'main' },
      { name: 'Force of Will', quantity: 1, category: 'sideboard' },
      { name: 'Zur the Enchanter', quantity: 1, category: 'commander' },
    ]);
    expect(parsed.meta.description).toBe('Test deck');
    expect(parsed.meta.priceUsd).toBe(12.34);
    // updatedAt is auto-bumped on serialize; just check it's a fresh ISO string
    expect(parsed.meta.updatedAt).not.toBe(meta.updatedAt);
    expect(new Date(parsed.meta.updatedAt).toString()).not.toBe('Invalid Date');
  });

  it('emptyCod produces a parseable empty deck', () => {
    const deck = parseCod(emptyCod('New Deck'));
    expect(deck.name).toBe('New Deck');
    expect(deck.cards).toEqual([]);
    expect(deck.meta.v).toBe(1);
  });

  it('serializeCod starts with an XML declaration and cockatrice_deck root', () => {
    const xml = serializeCod({ name: 'X', meta: defaultMeta(), cards: [] });
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<cockatrice_deck version="1">');
  });
});
