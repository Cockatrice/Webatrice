import { App } from '@app/types';
import {
  getScryfallUrlById,
  getScryfallUrlByName,
  getScryfallUrl,
} from './ScryfallService';

describe('ScryfallService', () => {
  describe('getScryfallUrlById', () => {
    it('builds a /cards/{id} image URL with the default small size', () => {
      expect(getScryfallUrlById('abc-123')).toBe(
        'https://api.scryfall.com/cards/abc-123?format=image&version=small',
      );
    });

    it('honors the requested size', () => {
      expect(getScryfallUrlById('abc-123', App.ScryfallImageSize.Normal)).toBe(
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
      expect(getScryfallUrlByName('Island', App.ScryfallImageSize.Normal)).toBe(
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
});
