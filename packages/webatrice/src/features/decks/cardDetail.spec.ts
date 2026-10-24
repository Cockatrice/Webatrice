import { selectCardFace, type ScryfallDetail } from '@app/services';

import { canAddBrowsedCard, describeCardDetail, resolveDetailRow } from './cardDetail';
import type { DeckCard } from './types';

function card(name: string, overrides: Partial<DeckCard> = {}): DeckCard {
  return { name, quantity: 1, category: 'main', lookupSource: 'scryfall', ...overrides };
}

describe('resolveDetailRow', () => {
  const deck = [card('Negate', { category: 'sideboard' }), card('Negate'), card('Sol Ring')];

  it('finds the clicked row by name and zone', () => {
    expect(resolveDetailRow(deck, card('Negate', { category: 'sideboard' }), null)).toBe(0);
    expect(resolveDetailRow(deck, card('Gone'), null)).toBe(-1);
  });

  it('prefers the main row of a browsed card', () => {
    expect(resolveDetailRow(deck, card('Sol Ring'), { name: 'Negate', kind: 'combo_piece' })).toBe(1);
    expect(resolveDetailRow([card('Negate', { category: 'sideboard' })], card('X'), { name: 'Negate', kind: 'combo_piece' }))
      .toBe(0);
  });
});

describe('describeCardDetail', () => {
  const transform: ScryfallDetail = {
    id: 'd',
    name: 'Delver of Secrets // Insectile Aberration',
    cmc: 1,
    set: 'isd',
    collector_number: '51',
    card_faces: [
      { name: 'Delver of Secrets', mana_cost: '{U}', type_line: 'Creature — Human Wizard', image_uris: { normal: 'front' } },
      { name: 'Insectile Aberration', type_line: 'Creature — Human Insect', oracle_text: 'Flying', image_uris: { normal: 'back' } },
    ],
  };

  it('shows a back face with its own art and text and no inherited CMC', () => {
    const face = selectCardFace(transform, 'Insectile Aberration');
    expect(describeCardDetail({ detail: transform, face, activeName: 'Insectile Aberration', liveCard: null, fallback: {} }))
      .toEqual({
        name: 'Insectile Aberration',
        imageUrl: 'back',
        typeLine: 'Creature — Human Insect',
        oracle: 'Flying',
        flavor: '',
        manaCost: '',
        cmc: undefined,
        setCode: 'isd',
        collectorNumber: '51',
      });
  });

  it('falls back to the deck row before Scryfall has answered', () => {
    const row = card('Sol Ring', { typeLine: 'Artifact', manaCost: '{1}', cmc: 1, set: 'c21', collectorNumber: '263' });
    expect(describeCardDetail({ detail: null, face: undefined, activeName: 'Sol Ring', liveCard: row, fallback: row }))
      .toEqual(expect.objectContaining({ typeLine: 'Artifact', manaCost: '{1}', cmc: 1, setCode: 'c21', imageUrl: undefined }));
  });
});

describe('canAddBrowsedCard', () => {
  it('only offers to add meld parts and combo pieces', () => {
    expect(['face', 'token', 'meld_part', 'meld_result', 'combo_piece'].filter((k) =>
      canAddBrowsedCard(k as Parameters<typeof canAddBrowsedCard>[0]))).toEqual(['meld_part', 'combo_piece']);
  });
});
