import { describe, expect, it } from 'vitest';

import { patchDeckDetails } from './deckDetailsXml';

const original = '<?xml version="1.0"?>\r\n<!DOCTYPE cockatrice_deck>\r\n<cockatrice_deck version="1">\r\n'
  + '  <deckname>Original</deckname><!-- <bannerCard>Fake</bannerCard> -->\r\n'
  + '  <bannerCard providerId="old">Island</bannerCard>\r\n'
  + '  <playmatCard zoom="1.0000">Swamp</playmatCard>\r\n'
  + '  <comments><![CDATA[<tags>not tags</tags>]]></comments>\r\n'
  + '  <tags custom="keep"><tag>A</tag><extra>Keep</extra></tags>\r\n'
  + '  <zone name="unknown"><card number="04" name="A &amp; B" odd=\'>\'/></zone>\r\n'
  + '  <extra><tags><tag>Nested</tag></tags></extra>\r\n</cockatrice_deck>\r\n';

describe('patchDeckDetails', () => {
  it('changes only the requested top-level banner bytes', () => {
    expect(patchDeckDetails(original, { banner: { name: 'Fire & Ice', providerId: 'new' } }))
      .toBe(original.replace('<bannerCard providerId="old">Island</bannerCard>',
        '<bannerCard providerId="new">Fire &amp; Ice</bannerCard>'));
  });

  it('changes only tags, retaining unknown tag children and attributes', () => {
    expect(patchDeckDetails(original, { tagsXml: '<tags custom="keep"><tag>B</tag><extra>Keep</extra></tags>' }))
      .toBe(original.replace('<tag>A</tag>', '<tag>B</tag>'));
  });

  it('inserts missing elements in desktop order and removes banners without touching other bytes', () => {
    const xml = '<cockatrice_deck><deckname>A</deckname><playmatCard>Island</playmatCard><comments/><zone name="main"/></cockatrice_deck>';
    expect(patchDeckDetails(xml, { banner: { name: 'Swamp' }, tagsXml: '<tags><tag>Ramp</tag></tags>' }))
      .toBe(xml.replace('<playmatCard>', '<bannerCard providerId="">Swamp</bannerCard><playmatCard>')
        .replace('<zone', '<tags><tag>Ramp</tag></tags><zone'));
    expect(patchDeckDetails(original, { banner: null }))
      .toBe(original.replace('<bannerCard providerId="old">Island</bannerCard>', ''));
  });

  it('renames by replacing only the deck name bytes, escaping markup', () => {
    expect(patchDeckDetails(original, { name: 'Fire & Ice <2>' }))
      .toBe(original.replace('<deckname>Original</deckname>', '<deckname>Fire &amp; Ice &lt;2&gt;</deckname>'));
  });

  it('inserts a missing deck name before the other metadata', () => {
    const xml = '<cockatrice_deck><comments/><zone name="main"/></cockatrice_deck>';
    expect(patchDeckDetails(xml, { name: 'Elves' })).toBe(xml.replace('<comments/>', '<deckname>Elves</deckname><comments/>'));
  });

  it('rejects invalid documents without rewriting them', () => {
    expect(() => patchDeckDetails('<broken>', { banner: null })).toThrow();
  });

  it('inserts into an empty root while preserving trailing comments and whitespace', () => {
    const xml = '<?xml version="1.0"?><cockatrice_deck version="1"/>\r\n<!-- keep -->\r\n';
    expect(patchDeckDetails(xml, { tagsXml: '<tags/>' }))
      .toBe('<?xml version="1.0"?><cockatrice_deck version="1"><tags/></cockatrice_deck>\r\n<!-- keep -->\r\n');
  });

  it('preserves nested metadata under extension elements with Unicode names', () => {
    const xml = '<cockatrice_deck><tags><tag>A</tag></tags><é><tags><tag>B</tag></tags></é></cockatrice_deck>';
    expect(patchDeckDetails(xml, { tagsXml: '<tags><tag>C</tag></tags>' })).toBe(xml.replace('<tag>A</tag>', '<tag>C</tag>'));
  });
});
