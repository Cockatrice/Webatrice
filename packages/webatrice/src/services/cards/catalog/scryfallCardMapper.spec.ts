import type { ScryfallCard } from '../../scryfall/types';
import { scryfallToLookup } from './scryfallCardMapper';

const DELVER: ScryfallCard = {
  id: 'delver',
  name: 'Delver of Secrets // Insectile Aberration',
  layout: 'transform',
  cmc: 1,
  color_identity: ['U'],
  colors: [],
  set: 'isd',
  collector_number: '51',
  card_faces: [
    { name: 'Delver of Secrets', mana_cost: '{U}', oracle_text: 'Front.', image_uris: { normal: 'front.jpg' } },
    { name: 'Insectile Aberration', oracle_text: 'Back.', image_uris: { small: 'back-small.jpg' } },
    { oracle_text: 'Nameless.' },
  ],
  all_parts: [
    { id: 'delver', component: 'combo_piece', name: 'Delver of Secrets // Insectile Aberration', uri: '' },
    { id: 'tower', component: 'combo_piece', name: 'Tower Winder', uri: '' },
    { id: 'meld', component: 'meld_part', name: 'Bruna', uri: '' },
    { id: 'meld-2', component: 'meld_part', name: 'Bruna', uri: '' },
  ],
  legalities: { modern: 'legal', vintage: 'restricted', standard: 'not_legal' },
};

describe('scryfallToLookup', () => {
  it('maps a multi-faced card: named faces, front-face art, joined face text, color identity fallback', () => {
    const result = scryfallToLookup(DELVER);

    expect(result).toMatchObject({
      found: true,
      source: 'scryfall',
      layout: 'transform',
      colors: ['U'],
      colorIdentity: ['U'],
      printings: [{ set: 'isd', collectorNumber: '51', scryfallId: 'delver', imageUri: 'front.jpg' }],
      text: 'Front.\n//\nBack.\n//\nNameless.',
    });
    expect(result.faces?.map((f) => [f.name, f.imageUri])).toEqual([
      ['Delver of Secrets', 'front.jpg'],
      ['Insectile Aberration', 'back-small.jpg'],
    ]);
  });

  it('keeps tokens and meld parts once each, never combo pieces or the card itself', () => {
    expect(scryfallToLookup(DELVER).related).toEqual([
      { name: 'Bruna', component: 'meld_part', origin: 'scryfall', scryfallId: 'meld' },
    ]);
  });

  it('drops not_legal formats and carries the type line as the only property', () => {
    const result = scryfallToLookup({ ...DELVER, type_line: 'Creature — Human Wizard' });
    expect(result.legalities).toEqual({ modern: 'legal', vintage: 'restricted' });
    expect(result.properties).toEqual({ type: 'Creature — Human Wizard' });
  });

  it('leaves optional groups undefined for a plain card', () => {
    const result = scryfallToLookup({ id: 'o', name: 'Opt', oracle_text: 'Scry 1.' });
    expect(result).toMatchObject({ related: undefined, faces: undefined, legalities: undefined, properties: undefined });
    expect(result.text).toBe('Scry 1.');
  });
});
