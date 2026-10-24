import type { DeckCard } from '../../types';
import type { ScryfallSearchCard } from '../../search';
import {
  dockColorIdentity,
  inspectedRow,
  resolveInspectedRow,
  resolvePreviewTarget,
  searchCardInspection,
} from './editorSelection';

const card = (name: string, category: DeckCard['category'] = 'main', extra: Partial<DeckCard> = {}): DeckCard =>
  ({ name, quantity: 1, category, lookupSource: 'scryfall', ...extra });

describe('resolveInspectedRow', () => {
  const cards = [
    card('Sol Ring', 'main', { scryfallId: 'sr-c21' }),
    card('Sol Ring', 'main', { scryfallId: 'sr-lea' }),
    card('Sol Ring', 'sideboard'),
    card('Ponder', 'sideboard'),
  ];
  const preview = card('Sol Ring');

  it('resolves a deck selection to exactly its zone, name and printing', () => {
    expect(resolveInspectedRow(cards, inspectedRow(cards[1]))).toBe(1);
    expect(resolveInspectedRow(cards, { name: 'sol ring', category: 'sideboard' })).toBe(2);
    expect(resolveInspectedRow(cards, { name: 'Sol Ring', category: 'main', scryfallId: 'sr-foil' })).toBe(-1);
    expect(resolveInspectedRow(cards, { name: 'Ponder', category: 'main' })).toBe(-1);
    expect(resolveInspectedRow(cards, null)).toBe(-1);
  });

  it('resolves a search pick without a chosen printing to any copy of the card', () => {
    expect(resolveInspectedRow(cards, { name: 'Sol Ring', category: 'main', preview })).toBe(0);
    expect(resolveInspectedRow(cards, { name: 'Ponder', category: 'main', preview })).toBe(3);
    expect(resolveInspectedRow(cards, { name: 'Brainstorm', category: 'main', preview })).toBe(-1);
  });

  it('keeps a search pick with a printing the deck lacks as a preview, in any zone', () => {
    expect(resolveInspectedRow(cards, { name: 'Sol Ring', category: 'main', scryfallId: 'sr-lea', preview })).toBe(1);
    expect(resolveInspectedRow(cards, { name: 'Sol Ring', category: 'sideboard', scryfallId: 'sr-lea', preview })).toBe(1);
    expect(resolveInspectedRow(cards, { name: 'Sol Ring', category: 'main', scryfallId: 'sr-foil', preview })).toBe(-1);
  });
});

describe('dockColorIdentity', () => {
  const bolt = card('Lightning Bolt', 'main', { colors: ['R'], colorIdentity: ['R'] });

  it('is the commanders\' combined identity, only in commander formats with a commander', () => {
    const atraxa = card('Atraxa', 'main', { isCommander: true, colors: ['g', 'W', 'U', 'B'], colorIdentity: ['g', 'W', 'U', 'B'] });
    const partner = card('Tymna', 'main', { isCommander: true, colors: ['W'], colorIdentity: ['W', 'B'] });
    expect(dockColorIdentity([atraxa, bolt], true)).toEqual(['W', 'U', 'B', 'G']);
    expect(dockColorIdentity([partner, card('Kozilek', 'main', { isCommander: true, colorIdentity: [] }), bolt], true)).toEqual(['W', 'B']);
    expect(dockColorIdentity([atraxa, bolt], false)).toBeUndefined();
    expect(dockColorIdentity([bolt], true)).toBeUndefined();
  });

  it('treats a known colourless identity as colourless, and an unknown one as no restriction', () => {
    const kozilek = card('Kozilek', 'main', { isCommander: true, colors: [], colorIdentity: [] });
    expect(dockColorIdentity([kozilek, bolt], true)).toEqual([]);
    const unknown = card('Mystery', 'main', { isCommander: true, colors: ['B'] });
    expect(dockColorIdentity([unknown, bolt], true)).toBeUndefined();
    const tasigur = card('Tasigur', 'main', { isCommander: true, colors: ['B'], colorIdentity: ['B', 'G', 'U'] });
    expect(dockColorIdentity([tasigur, unknown], true)).toBeUndefined();
  });
});

describe('searchCardInspection', () => {
  const bolt: ScryfallSearchCard = { id: 'bolt-m11', name: 'Lightning Bolt', type_line: 'Instant', mana_cost: '{R}', set: 'm11' };

  it('previews a search result as a main-deck card of its own printing', () => {
    const inspected = searchCardInspection(bolt);
    expect(inspected).toMatchObject({ name: 'Lightning Bolt', category: 'main', scryfallId: undefined });
    expect(inspected.preview).toMatchObject({ name: 'Lightning Bolt', scryfallId: 'bolt-m11', typeLine: 'Instant' });
  });

  it('shows the printing picked in the strip', () => {
    const inspected = searchCardInspection(bolt, 'bolt-2xm');
    expect(inspected.scryfallId).toBe('bolt-2xm');
    expect(inspected.preview?.scryfallId).toBe('bolt-2xm');
    expect(inspected.preview?.imageUri).toContain('bolt-2xm');
  });
});

describe('resolvePreviewTarget', () => {
  const cards = [card('Sol Ring'), card('Ponder', 'sideboard')];
  const selected = inspectedRow(cards[0]);

  it('shows the hovered row over the selected one', () => {
    expect(resolvePreviewTarget(cards, inspectedRow(cards[1]), selected)).toEqual({ card: inspectedRow(cards[1]), index: 1 });
  });

  it('falls back to the selection when nothing is hovered', () => {
    expect(resolvePreviewTarget(cards, null, selected)).toEqual({ card: selected, index: 0 });
    expect(resolvePreviewTarget(cards, null, null)).toEqual({ card: null, index: -1 });
  });

  it('shows a hovered search result even when the deck lacks it', () => {
    const hovered = { name: 'Brainstorm', category: 'main' as const, preview: card('Brainstorm') };
    expect(resolvePreviewTarget(cards, hovered, selected)).toEqual({ card: hovered, index: -1 });
  });

  it('ignores a hovered row that has since left the deck', () => {
    expect(resolvePreviewTarget(cards, inspectedRow(card('Brainstorm')), selected)).toEqual({ card: selected, index: 0 });
  });
});
