import { EMPTY_FILTERS, buildScryfallQuery, hasActiveFilters, toggleFilter, type SearchFiltersState } from './cardSearchQuery';

function filters(overrides: Partial<SearchFiltersState>): SearchFiltersState {
  return { ...EMPTY_FILTERS, ...overrides };
}

describe('buildScryfallQuery', () => {
  it.each<[string, string, Partial<SearchFiltersState>, string]>([
    ['typed text only, trimmed', '  bolt ', {}, 'bolt'],
    ['colors include', '', { colors: ['W', 'U'] }, 'c:wu'],
    ['colors exactly', '', { colors: ['R'], colorMode: 'exactly' }, 'c=r'],
    ['colors at most', '', { colors: ['B', 'G'], colorMode: 'atMost' }, 'c<=bg'],
    ['one type', '', { types: ['Creature'] }, 't:creature'],
    ['several types OR together', '', { types: ['Instant', 'Sorcery'] }, '(t:instant or t:sorcery)'],
    ['unquoted subtype ANDs each word', '', { subtype: 'Human  Warrior' }, 't:human t:warrior'],
    ['quoted subtype stays one clause', '', { subtype: '"Human Warrior"' }, 't:"human warrior"'],
    ['numeric mana value bounds', '', { cmcMin: '2', cmcMax: ' 4 ' }, 'cmc>=2 cmc<=4'],
    ['non-numeric mana value is ignored', '', { cmcMin: 'x', cmcMax: '-1' }, ''],
    ['oracle text is quoted and escaped', '', { oracle: 'draw "a" card' }, 'o:"draw \\"a\\" card"'],
    ['partial rarity selection', '', { rarities: ['rare', 'mythic'] }, '(r:rare or r:mythic)'],
    ['full rarity selection means no filter', '', { rarities: ['common', 'uncommon', 'rare', 'mythic'] }, ''],
  ])('%s', (_name, typed, overrides, expected) => {
    expect(buildScryfallQuery(typed, filters(overrides))).toBe(expected);
  });

  it('AND-combines the typed text with every filter in a stable order', () => {
    expect(buildScryfallQuery('bolt', filters({
      colors: ['R'],
      types: ['Instant'],
      subtype: 'arcane',
      cmcMax: '1',
      oracle: 'damage',
      rarities: ['common'],
    }))).toBe('bolt c:r t:instant t:arcane cmc<=1 o:"damage" r:common');
  });
});

describe('buildScryfallQuery with a deck scope', () => {
  it('searches within the commander’s colour identity', () => {
    const f = filters({ colorMode: 'withinIdentity', colors: ['R'] });
    expect(buildScryfallQuery('', f, { identity: ['W', 'U', 'B', 'G'] })).toBe('id<=wubg');
    expect(buildScryfallQuery('', f, { identity: [] })).toBe('id:c');
  });

  it('falls back to the picked colours when no identity is known', () => {
    expect(buildScryfallQuery('', filters({ colorMode: 'withinIdentity', colors: ['R'] }))).toBe('c<=r');
  });

  it('adds the deck format only for known Magic formats', () => {
    const f = filters({ legalOnly: true, types: ['Creature'] });
    expect(buildScryfallQuery('elf', f, { format: ' Commander ' })).toBe('elf t:creature f:commander');
    expect(buildScryfallQuery('elf', f, { format: 'house rules' })).toBe('elf t:creature');
    expect(buildScryfallQuery('elf', filters({ legalOnly: false }), { format: 'modern' })).toBe('elf');
  });
});

describe('hasActiveFilters', () => {
  it('ignores the advanced-panel toggle and blank text fields', () => {
    expect(hasActiveFilters(filters({ showAdvanced: true, subtype: '  ' }))).toBe(false);
    expect(hasActiveFilters(filters({ rarities: ['rare'] }))).toBe(true);
  });
});

describe('toggleFilter', () => {
  it('adds a missing item and removes a present one', () => {
    expect(toggleFilter(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleFilter(['a', 'b'], 'a')).toEqual(['b']);
  });
});
