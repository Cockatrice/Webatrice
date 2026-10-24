import { extraZoneSummary, isDeckFileName, parseDeckFile, readDeckFile } from './deckFiles';

const fileToParsedDeck = (name: string, text: string) => readDeckFile(name, text).deck;

describe('deck files', () => {
  it.each([
    ['burn.cod', true], ['burn.TXT', true], ['burn.dec', true], ['burn.dek', true], ['burn.mwDeck', true],
    ['cards.xml', false], ['replay.cor', false],
  ])('recognises %s as a deck file: %s', (name, expected) => {
    expect(isDeckFileName(name)).toBe(expected);
  });

  it('reads an MTGO .dek file', () => {
    const dek = '<?xml version="1.0"?><Deck><Cards CatID="1" Quantity="4" Sideboard="false" Name="Lightning Bolt" />'
      + '<Cards CatID="2" Quantity="2" Sideboard="true" Name="Negate" /></Deck>';
    const deck = fileToParsedDeck('burn.dek', dek);
    expect(deck.name).toBe('burn');
    expect(deck.cards).toEqual([
      { quantity: 4, name: 'Lightning Bolt', category: 'main' },
      { quantity: 2, name: 'Negate', category: 'sideboard' },
    ]);
  });

  it('falls back to plain text for a .cod that is not XML, as desktop does', () => {
    const parsed = parseDeckFile('old.cod', '4 Lightning Bolt\nSB: 2 Negate');
    expect(parsed.kind).toBe('list');
  });

  it('turns tokens and maybeboard sections of a text list into kept zones', () => {
    const deck = fileToParsedDeck('list.txt', 'Deck\n4 Lightning Bolt\nTokens\n1 Goblin\nMaybeboard\n2 Skewer the Critics');
    expect(deck.cards.map((c) => c.name)).toEqual(['Lightning Bolt']);
    expect(extraZoneSummary(deck.extraZonesXml)).toEqual([{ zone: 'tokens', count: 1 }, { zone: 'maybeboard', count: 2 }]);
  });

  it('keeps the deck name from the text, else the file name', () => {
    expect(fileToParsedDeck('x.txt', '// Boros Burn\n\n4 Lightning Bolt').name).toBe('Boros Burn');
    expect(fileToParsedDeck('Mono Red.txt', '4 Lightning Bolt').name).toBe('Mono Red');
  });

  it('reports the lines of a text file it could not read', () => {
    expect(readDeckFile('x.txt', '4 Lightning Bolt\n???\n0 Nothing').ignored).toEqual(['???', '0 Nothing']);
    const cod = '<cockatrice_deck version="1"><zone name="main"><card number="1" name="Opt"/></zone></cockatrice_deck>';
    expect(readDeckFile('x.cod', cod).ignored).toEqual([]);
  });
});
