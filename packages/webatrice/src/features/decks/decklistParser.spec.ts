import { inferDeckFormat, parseDecklist, promoteSideboardCommanders, type ParsedEntry } from './decklistParser';

type Row = [quantity: number, name: string, zone: string, set?: string, collectorNumber?: string];

function rows(entries: ParsedEntry[]): Row[] {
  return entries.map((e) => {
    const zone = e.extraZone ?? (e.isCommander ? 'commander' : e.category);
    const row: Row = [e.quantity, e.name, zone];
    if (e.set || e.collectorNumber) {
      row.push(e.set, e.collectorNumber);
    }
    return row;
  });
}

const COUNT_FORMS = [
  '4* Lightning Bolt', '4Lightning Bolt', 'x4 Lightning Bolt', '[4] Lightning Bolt', '(4) Lightning Bolt', '4x Lightning Bolt',
]
  .join('\n');

describe('parseDecklist', () => {
  it.each<[string, string, Row[], string[]?]>([
    ['plain counts', '4 Lightning Bolt\n20 Mountain', [[4, 'Lightning Bolt', 'main'], [20, 'Mountain', 'main']]],
    ['MTGO .txt: the block after a blank line is the sideboard',
      '4 Lightning Bolt\n20 Mountain\n\n2 Smash to Smithereens\n1 Pyroblast',
      [[4, 'Lightning Bolt', 'main'], [20, 'Mountain', 'main'],
        [2, 'Smash to Smithereens', 'sideboard'], [1, 'Pyroblast', 'sideboard']]],
    ['three blocks are not a sideboard split (desktop rule)', '1 A\n\n1 B\n\n1 C',
      [[1, 'A', 'main'], [1, 'B', 'main'], [1, 'C', 'main']]],
    ['MTGA export with set, number and headers',
      'About\nName Mono Red\n\nDeck\n4 Lightning Bolt (M11) 149\n\nSideboard\n2 Smash to Smithereens (ORI) 163',
      [[4, 'Lightning Bolt', 'main', 'M11', '149'], [2, 'Smash to Smithereens', 'sideboard', 'ORI', '163']]],
    ['MTGA commander section', 'Commander\n1 Atraxa, Praetors\' Voice (2X2) 190\n\nDeck\n1 Sol Ring (CMM) 410',
      [[1, 'Atraxa, Praetors\' Voice', 'commander', '2X2', '190'], [1, 'Sol Ring', 'main', 'CMM', '410']]],
    ['section headers with counts and colons', 'Commander (1)\n1 Atraxa, Praetors\' Voice\nDeck (99)\n1 Sol Ring\nSIDEBOARD:\n1 Negate',
      [[1, 'Atraxa, Praetors\' Voice', 'commander'], [1, 'Sol Ring', 'main'], [1, 'Negate', 'sideboard']]],
    ['Moxfield foil and etched markers', '1 Sol Ring (CMM) 410 *F*\n1 Arcane Signet (ELD) 331 *E*',
      [[1, 'Sol Ring', 'main', 'CMM', '410'], [1, 'Arcane Signet', 'main', 'ELD', '331']]],
    ['Archidekt categories and tags',
      '1x Sol Ring (cmm) 410 [Ramp] ^Have,#37d67a^\n1x Atraxa, Praetors\' Voice (2x2) 190 [Commander{top}]\n1x Cultivate [Maybeboard]',
      [[1, 'Sol Ring', 'main', 'CMM', '410'], [1, 'Atraxa, Praetors\' Voice', 'commander', '2X2', '190'],
        [1, 'Cultivate', 'maybeboard']]],
    ['TappedOut commander marker', '1x Sol Ring\n1x Zur the Enchanter *CMDR*',
      [[1, 'Sol Ring', 'main'], [1, 'Zur the Enchanter', 'commander']]],
    ['lines without a count are one copy', 'Lightning Bolt\nCommander\'s Sphere',
      [[1, 'Lightning Bolt', 'main'], [1, 'Commander\'s Sphere', 'main']]],
    ['MWS set prefix', '4 [M11] Lightning Bolt\nSB: 2 [ORI] Smash to Smithereens',
      [[4, 'Lightning Bolt', 'main', 'M11', undefined], [2, 'Smash to Smithereens', 'sideboard', 'ORI', undefined]]],
    ['SB: marks win over blank lines', '4 Lightning Bolt\n\n1 Mountain\nSB: 2 Negate',
      [[4, 'Lightning Bolt', 'main'], [1, 'Mountain', 'main'], [2, 'Negate', 'sideboard']]],
    ['split and double-faced names', '1 Fire/Ice\n1 Delver of Secrets // Insectile Aberration (ISD) 51\n1 Wear | Tear',
      [[1, 'Fire // Ice', 'main'], [1, 'Delver of Secrets // Insectile Aberration', 'main', 'ISD', '51'],
        [1, 'Wear // Tear', 'main']]],
    ['The List and star collector numbers', '1 Lightning Bolt (PLST) 2XM-129\n1 Sol Ring (SLD) 1011★',
      [[1, 'Lightning Bolt', 'main', 'PLST', '2XM-129'], [1, 'Sol Ring', 'main', 'SLD', '1011★']]],
    ['tokens and maybeboard sections', 'Deck\n1 Sol Ring\nTokens\n1 Goblin\nMaybeboard\n1 Cultivate',
      [[1, 'Sol Ring', 'main'], [1, 'Goblin', 'tokens'], [1, 'Cultivate', 'maybeboard']]],
    ['Deckstats comment headers', '//Main\n4 Lightning Bolt\n//Sideboard\n2 Negate',
      [[4, 'Lightning Bolt', 'main'], [2, 'Negate', 'sideboard']]],
    ['desktop count forms', COUNT_FORMS,
      Array.from({ length: 6 }, (): Row => [4, 'Lightning Bolt', 'main'])],
    ['curly apostrophes', '1 Praetors’ Grasp', [[1, 'Praetors\' Grasp', 'main']]],
    ['type group headers are skipped', 'Creatures (2)\n2 Goblin Guide', [[2, 'Goblin Guide', 'main']], ['Creatures (2)']],
    ['tabs and CRLF', '4\tLightning Bolt\r\n2 Mountain\r\n', [[4, 'Lightning Bolt', 'main'], [2, 'Mountain', 'main']]],
  ])('%s', (_label, text, expected, ignored = []) => {
    const result = parseDecklist(text);
    expect(rows(result.entries)).toEqual(expected);
    expect(result.ignored).toEqual(ignored);
  });

  it('reads the deck name from an Arena About section', () => {
    expect(parseDecklist('About\nName Mono Red\n\nDeck\n4 Lightning Bolt').name).toBe('Mono Red');
  });

  it('reads desktop\'s clipboard export: name and comments, then type headers', () => {
    const text = '// Boros Burn\n// Fast and mean\n\n// 24 Maindeck\n// 20 Land\n20 Mountain\n// 4 Instant\n4 Lightning Bolt\n\n'
      + '// 2 Sideboard\nSB: 2 Smash to Smithereens';
    const result = parseDecklist(text);
    expect(result.name).toBe('Boros Burn');
    expect(result.description).toBe('Fast and mean');
    expect(rows(result.entries)).toEqual([
      [20, 'Mountain', 'main'], [4, 'Lightning Bolt', 'main'], [2, 'Smash to Smithereens', 'sideboard'],
    ]);
  });

  it('reports lines it cannot read', () => {
    expect(parseDecklist('4 Lightning Bolt\n0 Nothing\n???').ignored).toEqual(['0 Nothing', '???']);
  });
});

describe('promoteSideboardCommanders', () => {
  const singles = (n: number): ParsedEntry[] => Array.from({ length: n }, (_, i) => ({ quantity: 1, name: `Card ${i}`, category: 'main' }));

  it('treats a one-card MTGO sideboard on a 100-card singleton list as the commander', () => {
    const cards: ParsedEntry[] = [...singles(99), { quantity: 1, name: 'Atraxa', category: 'sideboard' }];
    const promoted = promoteSideboardCommanders(cards);
    expect(promoted.find((c) => c.name === 'Atraxa')).toMatchObject({ category: 'main', isCommander: true });
  });

  it('leaves a 60-card sideboard alone', () => {
    const cards: ParsedEntry[] = [{ quantity: 4, name: 'Bolt', category: 'main' }, { quantity: 1, name: 'Negate', category: 'sideboard' }];
    expect(promoteSideboardCommanders(cards)).toEqual(cards);
  });
});

describe('inferDeckFormat', () => {
  it.each<[string, ParsedEntry[], string]>([
    ['a commander section', [{ quantity: 1, name: 'Zur', category: 'main', isCommander: true }], 'commander'],
    ['100 singletons plus basics', [
      ...Array.from({ length: 70 }, (_, i): ParsedEntry => ({ quantity: 1, name: `Card ${i}`, category: 'main' })),
      { quantity: 30, name: 'Island', category: 'main' },
    ], 'commander'],
    ['a 60-card playset deck', [{ quantity: 4, name: 'Bolt', category: 'main' }, { quantity: 56, name: 'Mountain', category: 'main' }], ''],
  ])('%s', (_label, cards, format) => {
    expect(inferDeckFormat(cards)).toBe(format);
  });
});
