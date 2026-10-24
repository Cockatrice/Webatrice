import { ScryfallImageSize } from '@cockatrice/datatrice';
import {
  getScryfallUrlByExactName,
  getScryfallUrlById,
  getScryfallUrlByIdOrExactName,
  getScryfallUrlByName,
  getScryfallUrl,
  getScryfallSymbolUrl,
} from './imageUrls';

describe('Scryfall image URLs', () => {
  describe('getScryfallUrlById', () => {
    it('builds a /cards/{id} image URL with the default small size', () => {
      expect(getScryfallUrlById('abc-123')).toBe(
        'https://api.scryfall.com/cards/abc-123?format=image&version=small',
      );
    });

    it('honors the requested size', () => {
      expect(getScryfallUrlById('abc-123', ScryfallImageSize.Normal)).toBe(
        'https://api.scryfall.com/cards/abc-123?format=image&version=normal',
      );
    });

    it('URL-encodes the provider id', () => {
      expect(getScryfallUrlById('foo bar/baz')).toContain('foo%20bar%2Fbaz');
    });
  });

  describe('getScryfallUrlByName', () => {
    it('builds a /cards/named?exact= image URL', () => {
      expect(getScryfallUrlByName('Lightning Bolt')).toBe(
        'https://api.scryfall.com/cards/named?exact=Lightning%20Bolt&format=image&version=small',
      );
    });

    it('honors the requested size', () => {
      expect(getScryfallUrlByName('Island', ScryfallImageSize.Normal)).toBe(
        'https://api.scryfall.com/cards/named?exact=Island&format=image&version=normal',
      );
    });

    it('URL-encodes commas, apostrophes, and slashes in card names', () => {
      expect(getScryfallUrlByName('Jace, the Mind Sculptor')).toContain('Jace%2C%20the%20Mind%20Sculptor');
    });

    it('strips a trailing "(Token)" suffix (Cockatrice tokens.xml namespacing) before lookup', () => {
      expect(getScryfallUrlByName('Soldier (Token)')).toBe(
        'https://api.scryfall.com/cards/named?exact=Soldier&format=image&version=small',
      );
    });

    it('strips a trailing bare "Token" suffix (no parens) before lookup', () => {
      expect(getScryfallUrlByName('Soldier Token')).toContain('exact=Soldier&');
    });

    it('strips the suffix case-insensitively, with or without parens', () => {
      expect(getScryfallUrlByName('soldier (token)')).toContain('exact=soldier&');
      expect(getScryfallUrlByName('soldier token')).toContain('exact=soldier&');
    });

    it('does not touch names that lack the suffix', () => {
      expect(getScryfallUrlByName('Soldier')).toContain('exact=Soldier&');
    });

    it('only strips a trailing "Token" word, not a mid-name occurrence', () => {
      expect(getScryfallUrlByName('Token of Appreciation')).toContain(
        'exact=Token%20of%20Appreciation&',
      );
    });

    it('does not strip "Token" when it is fused into another word at the end', () => {
      expect(getScryfallUrlByName('Untoken')).toContain('exact=Untoken&');
    });
  });

  describe('getScryfallUrl (dispatcher)', () => {
    it('prefers providerId when present', () => {
      expect(getScryfallUrl({ providerId: 'id-1', name: 'Anything' })).toBe(
        getScryfallUrlById('id-1'),
      );
    });

    it('falls back to name when providerId is empty', () => {
      expect(getScryfallUrl({ providerId: '', name: 'Island' })).toBe(
        getScryfallUrlByName('Island'),
      );
    });

    it('falls back to name when providerId is undefined', () => {
      expect(getScryfallUrl({ name: 'Island' })).toBe(getScryfallUrlByName('Island'));
    });

    it('returns null when the card has no identifier at all', () => {
      expect(getScryfallUrl({})).toBeNull();
      expect(getScryfallUrl({ providerId: '', name: '' })).toBeNull();
    });
  });

  describe('getScryfallSymbolUrl', () => {
    it('maps bare symbols and braced tokens to the Scryfall CDN, dropping hybrid slashes', () => {
      expect(getScryfallSymbolUrl('W')).toBe('https://svgs.scryfall.io/card-symbols/W.svg');
      expect(getScryfallSymbolUrl('{2}')).toBe('https://svgs.scryfall.io/card-symbols/2.svg');
      expect(getScryfallSymbolUrl('{W/U}')).toBe('https://svgs.scryfall.io/card-symbols/WU.svg');
      expect(getScryfallSymbolUrl('{2/W}')).toBe('https://svgs.scryfall.io/card-symbols/2W.svg');
    });
  });

  describe('getScryfallUrlByExactName', () => {
    it('encodes the name as given, keeping a Token suffix', () => {
      expect(getScryfallUrlByExactName('Rhino, Warrior Token', ScryfallImageSize.ArtCrop)).toBe(
        'https://api.scryfall.com/cards/named?exact=Rhino%2C%20Warrior%20Token&format=image&version=art_crop',
      );
    });
  });

  describe('getScryfallUrlByIdOrExactName', () => {
    it('uses the id when there is one, else the exact name untouched', () => {
      expect(getScryfallUrlByIdOrExactName({ scryfallId: 'id-1', name: 'X' }, ScryfallImageSize.Large)).toBe(
        'https://api.scryfall.com/cards/id-1?format=image&version=large',
      );
      expect(getScryfallUrlByIdOrExactName({ scryfallId: '', name: 'Soldier Token' }, ScryfallImageSize.Png)).toBe(
        'https://api.scryfall.com/cards/named?exact=Soldier%20Token&format=image&version=png',
      );
    });
  });
});
