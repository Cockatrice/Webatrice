import type { DeckMeta, ParsedCard } from '@app/types';

import { emptyCod, parseCod, serializeCod, validateCod } from './cockatriceDeckDocument';
import { defaultMeta, serializeMeta } from './cockatriceDeckMetadata';

describe('validateCod', () => {
  it.each([
    ['', false],
    ['not xml', false],
    ['<cockatrice_deck>', false],
    ['<other><cockatrice_deck/></other>', false],
    ['<Cockatrice_Deck/>', false],
    ['<cockatrice_deck/>', true],
    ['<?xml version="1.0"?><cockatrice_deck><zone name="main"/></cockatrice_deck>', true],
  ])('validates the envelope of %s', (xml, valid) => {
    expect(validateCod(xml)).toBe(valid);
    expect(validateCod(new DOMParser().parseFromString(xml, 'application/xml'))).toBe(valid);
  });
});

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
    // Webatrice doesn't model a `commander` deck category anymore —
    // Servatrice only ships `main`/`side` into the game library at
    // start, so the commander zone coerces to `main` while the card
    // keeps its `isCommander` flag (parseCod comment).
    expect(deck.cards[0].category).toBe('main');
    expect(deck.cards[0].isCommander).toBe(true);
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

  it('keeps desktop tokens, maybeboard and custom zones out of the deck and writes them back unchanged', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_deck version="1">
  <deckname>Boros Burn</deckname>
  <comments>Plan vs control: +2 Smash.
Notes from FNM.</comments>
  <zone name="main">
    <card number="4" name="Lightning Bolt" setShortName="M11" collectorNumber="149"/>
    <zone name="Burn spells"><card number="4" name="Lava Spike"/></zone>
  </zone>
  <zone name="side"><card number="2" name="Smash to Smithereens"/></zone>
  <zone name="tokens"><card number="1" name="Goblin" setShortName="TM20"/></zone>
  <zone name="maybeboard"><card number="2" name="Skewer the Critics"/></zone>
</cockatrice_deck>`;
    const parsed = parseCod(xml);
    expect(parsed.cards.map((c) => [c.name, c.category, c.zonePath ?? []])).toEqual([
      ['Lightning Bolt', 'main', []],
      ['Lava Spike', 'main', ['Burn spells']],
      ['Smash to Smithereens', 'sideboard', []],
    ]);
    expect(parsed.extraZonesXml).toHaveLength(2);
    expect(parsed.meta.description).toBe('Plan vs control: +2 Smash.\nNotes from FNM.');

    const doc = new DOMParser().parseFromString(serializeCod(parsed), 'application/xml');
    const zones = Array.from(doc.documentElement.children).filter((el) => el.tagName === 'zone');
    expect(zones.map((z) => z.getAttribute('name'))).toEqual(['main', 'side', 'tokens', 'maybeboard']);
    expect(zones[0].querySelector(':scope > zone[name="Burn spells"] > card')?.getAttribute('name')).toBe('Lava Spike');
    expect(zones[2].querySelector('card')?.getAttribute('name')).toBe('Goblin');
    expect(doc.querySelector('comments')?.textContent).toBe('Plan vs control: +2 Smash.\nNotes from FNM.');
    expect(parseCod(serializeCod(parsed)).cards).toEqual(parsed.cards);
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
    const cards: Array<ParsedCard & { lookupSource: 'dexie' }> = [
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
      { name: 'Zur the Enchanter', quantity: 1, category: 'main', isCommander: true, lookupSource: 'dexie' },
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
    // serializeCod groups cards into one <zone> per category (main
    // first, then sideboard), so the round-tripped order isn't the
    // original input order — it's category-then-input order.
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
      { name: 'Zur the Enchanter', quantity: 1, category: 'main', isCommander: true },
      { name: 'Force of Will', quantity: 1, category: 'sideboard' },
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

  it('keeps desktop\'s <playmatCard> verbatim, next to <bannerCard>', () => {
    const desktop = '<?xml version="1.0" encoding="UTF-8"?>'
      + '<cockatrice_deck version="1"><deckname>Mat</deckname><format>commander</format>'
      + '<bannerCard providerId="b-1">Sol Ring</bannerCard>'
      + '<playmatCard providerId="p-1" marginPctL="0.1000" marginPctR="0.2000" verticalOffset="0.0500" zoom="1.2500">'
      + 'Island</playmatCard>'
      + '<comments/><tags><tag>Ramp</tag></tags><zone name="main"/></cockatrice_deck>';

    const parsed = parseCod(desktop);
    const xml = serializeCod(parsed);

    const root = new DOMParser().parseFromString(xml, 'application/xml').documentElement;
    const names = Array.from(root.children).map((el) => el.tagName);
    expect(names.indexOf('playmatCard')).toBe(names.indexOf('bannerCard') + 1);
    const playmat = root.querySelector('playmatCard')!;
    expect(playmat.textContent).toBe('Island');
    expect(['providerId', 'marginPctL', 'marginPctR', 'verticalOffset', 'zoom'].map((a) => playmat.getAttribute(a)))
      .toEqual(['p-1', '0.1000', '0.2000', '0.0500', '1.2500']);
    expect(parseCod(xml).playmatXml).toBe(parsed.playmatXml);
  });

  it('writes no <playmatCard> for a deck without one', () => {
    expect(serializeCod({ name: 'X', meta: defaultMeta(), cards: [] })).not.toContain('playmatCard');
  });

  it('keeps desktop\'s <sideboard_plan>s verbatim, after the zones', () => {
    const plan = (name: string, card: string) => '<sideboard_plan>'
      + `<name>${name}</name>`
      + `<move_card_to_zone><card_name>${card}</card_name><start_zone>main</start_zone>`
      + '<target_zone>side</target_zone></move_card_to_zone>'
      + '</sideboard_plan>';
    const desktop = '<?xml version="1.0" encoding="UTF-8"?>'
      + '<cockatrice_deck version="1"><deckname>Plans</deckname><comments/>'
      + '<zone name="main"><card number="4" name="Opt"/></zone>'
      + '<zone name="side"><card number="2" name="Negate"/></zone>'
      + plan('', 'Opt') + plan('vs. control', 'Opt')
      + '</cockatrice_deck>';

    const parsed = parseCod(desktop);
    const xml = serializeCod(parsed);

    const root = new DOMParser().parseFromString(xml, 'application/xml').documentElement;
    expect(Array.from(root.children).map((el) => el.tagName).slice(-4))
      .toEqual(['zone', 'zone', 'sideboard_plan', 'sideboard_plan']);
    const plans = Array.from(root.querySelectorAll('sideboard_plan'));
    expect(plans.map((el) => el.querySelector('name')?.textContent)).toEqual(['', 'vs. control']);
    expect(plans[1].querySelector('move_card_to_zone > card_name')?.textContent).toBe('Opt');
    expect(parseCod(xml).sideboardPlansXml).toEqual(parsed.sideboardPlansXml);
    expect(parsed.sideboardPlansXml).toHaveLength(2);
  });

  it('writes no <sideboard_plan> for a deck without one', () => {
    const parsed = parseCod(serializeCod({ name: 'X', meta: defaultMeta(), cards: [] }));
    expect(parsed.sideboardPlansXml).toEqual([]);
    expect(serializeCod(parsed)).not.toContain('sideboard_plan');
  });

  it('serializeCod starts with an XML declaration and cockatrice_deck root', () => {
    const xml = serializeCod({ name: 'X', meta: defaultMeta(), cards: [] });
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<cockatrice_deck version="1">');
  });
});
