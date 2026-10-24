import {
  analyzeBracket,
  deckFingerprint,
  fromBracketAssessment,
  isCompleteAnalysis,
  toBracketAssessment,
} from './bracket';
import { fetchGameChangers, fetchOracleText, fetchSpellbookCombos } from './bracketSources';
import type { DeckCard } from './types';

vi.mock('./bracketSources', () => ({
  fetchGameChangers: vi.fn(),
  fetchOracleText: vi.fn(),
  fetchSpellbookCombos: vi.fn(),
}));

function card(name: string, quantity = 1): DeckCard {
  return { name, quantity, category: 'main', lookupSource: 'scryfall' };
}

const deck = [card('Savor the Moment'), card('Rhystic Study'), card('Forest', 30)];

beforeEach(() => {
  vi.mocked(fetchGameChangers).mockResolvedValue({ status: 'ok', data: new Set(['Rhystic Study']) });
  vi.mocked(fetchOracleText).mockResolvedValue({
    status: 'ok',
    data: new Map([['savor the moment', 'Target player takes an extra turn after this one.'], ['forest', '']]),
  });
  vi.mocked(fetchSpellbookCombos).mockResolvedValue({ status: 'ok', data: [] });
});

describe('analyzeBracket', () => {
  it('classifies a deck from complete data', async () => {
    const analysis = await analyzeBracket(deck);

    expect(isCompleteAnalysis(analysis)).toBe(true);
    expect(analysis.report.signals.turns.matches).toEqual(['Savor the Moment']);
    expect(analysis.report.signals.gameChangers.matches).toEqual(['Rhystic Study']);
    expect(analysis.report.level).toBe(3);
    expect(fetchOracleText).toHaveBeenCalledWith(['Savor the Moment', 'Rhystic Study', 'Forest']);
  });

  it('marks the analysis incomplete when a source is unavailable, keeping what it could find', async () => {
    vi.mocked(fetchSpellbookCombos).mockResolvedValue({ status: 'unavailable', failure: { kind: 'http', status: 500 } });
    vi.mocked(fetchGameChangers).mockResolvedValue({ status: 'unavailable', failure: { kind: 'timeout' } });

    const analysis = await analyzeBracket(deck);

    expect(isCompleteAnalysis(analysis)).toBe(false);
    expect(analysis.unavailable).toEqual([
      { source: 'gameChangers', failure: { kind: 'timeout' } },
      { source: 'combos', failure: { kind: 'http', status: 500 } },
    ]);
    expect(analysis.report.level).toBe(2);
  });

  it('marks partial oracle text as incomplete with its coverage', async () => {
    vi.mocked(fetchOracleText).mockResolvedValue({
      status: 'partial',
      data: new Map([['forest', '']]),
      failure: { kind: 'network' },
      missing: 2,
      total: 3,
    });

    const analysis = await analyzeBracket(deck);

    expect(analysis.unavailable).toEqual([
      { source: 'oracleText', failure: { kind: 'network' }, missing: 2, total: 3 },
    ]);
    expect(analysis.report.signals.turns.matches).toEqual([]);
  });
});

describe('fingerprints and the persisted form', () => {
  it('fingerprints names and quantities, ignoring case, order and printing', () => {
    const a = deckFingerprint([card('A'), card('b', 2)]);
    expect(a).toMatch(/^[0-9a-z]{8}$/);
    expect(deckFingerprint([{ ...card('B', 2), set: 'x' }, card('a')])).toBe(a);
    expect(deckFingerprint([card('A'), card('b', 3)])).not.toBe(a);
  });

  it('changes when a card changes zone or commander status, since the combo lookup depends on both', () => {
    const a = deckFingerprint([card('A'), card('b', 2)]);
    expect(deckFingerprint([card('A'), { ...card('b', 2), category: 'sideboard' }])).not.toBe(a);
    expect(deckFingerprint([{ ...card('A'), isCommander: true }, card('b', 2)])).not.toBe(a);
  });

  it('round-trips a report through the persisted assessment', async () => {
    const { report } = await analyzeBracket(deck);
    const persisted = toBracketAssessment(report, 'abcdefgh');
    expect(persisted.fingerprint).toBe('abcdefgh');
    expect(fromBracketAssessment(persisted)).toEqual(report);
  });
});
