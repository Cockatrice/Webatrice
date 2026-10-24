import type { Token } from '@app/services';

import { cockatriceXmlParser } from './CockatriceXmlParser';
import { writeCockatriceXml } from './CockatriceXmlWriter';

describe('writeCockatriceXml', () => {
  const token: Token = {
    name: { value: 'Spirit & Friend' },
    text: { value: 'Flying' },
    prop: { value: { colors: { value: 'W' }, pt: { value: '1/1' }, type: { value: 'Token Creature — Spirit' } } },
    set: { value: 'TK', picurl: 'https://img.example/spirit.jpg' },
    token: { value: '1' },
  };

  it('writes a v4 database the parser reads back', () => {
    const xml = writeCockatriceXml({
      sets: [{ name: { value: 'TK' }, longname: { value: 'Dummy set containing tokens' } }],
      cards: [token],
    });

    const parsed = cockatriceXmlParser.parse(xml);
    expect(parsed.sets?.[0].name.value).toBe('TK');
    expect(parsed.tokens).toHaveLength(1);
    const [read] = parsed.tokens!;
    expect(read).toEqual(token);
    expect(read.prop?.value.pt.value).toBe('1/1');
    expect(read.set).toEqual({ value: 'TK', picurl: 'https://img.example/spirit.jpg' });
  });

  it('escapes markup characters in text and attributes', () => {
    const xml = writeCockatriceXml({ cards: [token] });
    expect(xml).toContain('<name>Spirit &amp; Friend</name>');
    expect(xml).not.toContain('Spirit & Friend');
  });

  it('repeats siblings stored as arrays', () => {
    const xml = writeCockatriceXml({ cards: [{ ...token, set: [{ value: 'TK' }, { value: 'M21' }] }] });
    expect(xml.match(/<set>/g)).toHaveLength(2);
  });
});
