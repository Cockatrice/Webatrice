import { storageEditConflict } from './deckStorageEdits';

const cod = ({ name = 'Deck', banner = 'Island', tags = ['Ramp'], cards = '<card number="4" name="Swamp"/>' } = {}) =>
  '<cockatrice_deck version="1">'
  + `<deckname>${name}</deckname><bannerCard providerId="">${banner}</bannerCard>`
  + `<tags>${tags.map((tag) => `<tag>${tag}</tag>`).join('')}</tags>`
  + `<zone name="main">${cards}</zone></cockatrice_deck>`;

describe('storageEditConflict', () => {
  it('finds no conflict when the stored file is unchanged', () => {
    expect(storageEditConflict(cod(), cod(), { name: 'New' })).toBe(false);
  });

  it('refuses when the card list changed elsewhere, whatever is being edited', () => {
    const changed = cod({ cards: '<card number="3" name="Swamp"/>' });
    expect(storageEditConflict(cod(), changed, { name: 'New' })).toBe(true);
    expect(storageEditConflict(cod(), changed, { tags: [] })).toBe(true);
    expect(storageEditConflict(cod(), changed, { banner: null })).toBe(true);
  });

  it('refuses when the field being edited changed elsewhere', () => {
    expect(storageEditConflict(cod(), cod({ name: 'Renamed' }), { name: 'Mine' })).toBe(true);
    expect(storageEditConflict(cod(), cod({ tags: ['Burn'] }), { tags: ['Mine'] })).toBe(true);
    expect(storageEditConflict(cod(), cod({ banner: 'Swamp' }), { banner: null })).toBe(true);
  });

  it('lets an edit through when only another field changed, since only the edited element is patched', () => {
    expect(storageEditConflict(cod(), cod({ tags: ['Burn'] }), { name: 'Mine' })).toBe(false);
    expect(storageEditConflict(cod(), cod({ name: 'Renamed' }), { banner: null })).toBe(false);
  });
});
