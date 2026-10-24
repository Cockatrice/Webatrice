import { describe, expect, it } from 'vitest';

import { games } from '@cockatrice/datatrice';

import { parseCod, serializeCod } from './cockatriceDeckDocument';
import { readDeckPlaymat, writeDeckPlaymat } from './deckPlaymat';
import desktopDeck from './fixtures/desktop-playmat.cod?raw';

const desktopPlaymat = '<playmatCard providerId="printing-id" marginPctL="0.0700"'
  + ' marginPctR="0.1200" verticalOffset="0.3300" zoom="1.2500">Fire &amp; Ice</playmatCard>';

describe('desktop playmat XML', () => {
  it('round trips the desktop writer element exactly, including attribute order and four decimal places', () => {
    expect(writeDeckPlaymat(readDeckPlaymat(desktopPlaymat))).toBe(desktopPlaymat);
    const parsed = parseCod(desktopDeck);
    expect(readDeckPlaymat(parsed.playmatXml)).toEqual({ cardName: 'Fire & Ice', cardProviderId: 'printing-id',
      params: { marginPctL: 0.07, marginPctR: 0.12, verticalOffset: 0.33, zoom: 1.25 } });
    const xml = serializeCod(parsed);
    expect(xml).toContain(desktopPlaymat);
    const root = new DOMParser().parseFromString(xml, 'application/xml').documentElement;
    expect(Array.from(root.children, (element) => element.tagName)).toEqual([
      'lastLoadedTimestamp', 'deckname', 'format', 'bannerCard', 'playmatCard', 'comments', 'tags', 'zone',
    ]);
  });

  it('uses desktop defaults for missing and malformed values and clamps bounds', () => {
    expect(readDeckPlaymat('<playmatCard>Island</playmatCard>')?.params).toEqual(games.DEFAULT_PLAYMAT_PARAMS);
    expect(readDeckPlaymat('<playmatCard marginPctL="no" marginPctR="3" verticalOffset="-2" zoom="2oops">Island</playmatCard>')?.params)
      .toEqual({ marginPctL: 0.07, marginPctR: 0.95, verticalOffset: 0, zoom: 1 });
    expect(readDeckPlaymat('<playmatCard zoom="0">Island</playmatCard>')?.params.zoom).toBe(0.1);
  });

  it('removes empty playmats and rejects malformed or unrelated XML', () => {
    for (const xml of [undefined, '<playmatCard/>', '<other>Island</other>', '<playmatCard>']) {
      expect(readDeckPlaymat(xml)).toBeNull();
    }
    expect(writeDeckPlaymat(null)).toBeUndefined();
  });

  it('writes an empty provider id and rounds numeric params as desktop does', () => {
    expect(writeDeckPlaymat({ cardName: 'Island', cardProviderId: '',
      params: { marginPctL: 0.071234, marginPctR: 0.07, verticalOffset: 0.33, zoom: 1 } }))
      .toBe('<playmatCard providerId="" marginPctL="0.0712" marginPctR="0.0700"'
        + ' verticalOffset="0.3300" zoom="1.0000">Island</playmatCard>');
  });

  it('preserves untouched older XML but writes structured edits and explicit removal', () => {
    const original = '<playmatCard providerId="id" zoom="1" custom="keep">Island</playmatCard>';
    const deck = parseCod(`<cockatrice_deck>${original}</cockatrice_deck>`);
    expect(serializeCod(deck)).toContain(original);
    const originalPlaymat = readDeckPlaymat(deck.playmatXml)!;
    const playmat = { ...originalPlaymat, params: { ...originalPlaymat.params, zoom: 2 } };
    expect(serializeCod({ ...deck, playmatXml: writeDeckPlaymat(playmat) })).toContain(writeDeckPlaymat(playmat));
    expect(serializeCod({ ...deck, playmatXml: undefined })).not.toContain('playmatCard');
  });
});
