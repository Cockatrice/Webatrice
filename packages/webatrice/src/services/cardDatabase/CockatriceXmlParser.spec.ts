import { cockatriceXmlParser } from './CockatriceXmlParser';

describe('CockatriceXmlParser', () => {
  describe('parseElement (generic XML→object)', () => {
    function parseFragment(xml: string) {
      const dom = new DOMParser().parseFromString(xml, 'application/xml');
      return cockatriceXmlParser.parseElement(dom.documentElement);
    }

    it('parses simple child elements into key-value pairs', () => {
      const result = parseFragment('<card><name value="Soldier" /></card>') as { name: { value: string } };
      expect(result.name.value).toBe('Soldier');
    });

    it('parses nested elements recursively', () => {
      const result = parseFragment('<card><prop><cmc value="2" /></prop></card>') as { prop: { value: { cmc: { value: string } } } };
      expect(result.prop.value).toHaveProperty('cmc');
      expect(result.prop.value.cmc.value).toBe('2');
    });

    it('includes XML attributes alongside value', () => {
      const xml = '<card><set value="M21" picURL="http://img.png" /></card>';
      const result = parseFragment(xml) as { set: { value: string; picURL: string } };
      expect(result.set.value).toBe('M21');
      expect(result.set.picURL).toBe('http://img.png');
    });

    it('converts duplicate tag names into an array preserving all values', () => {
      const result = parseFragment(
        '<card><related value="Token A" /><related value="Token B" /></card>'
      ) as { related: { value: string }[] };
      expect(Array.isArray(result.related)).toBe(true);
      expect(result.related).toHaveLength(2);
      expect(result.related[0].value).toBe('Token A');
      expect(result.related[1].value).toBe('Token B');
    });

    it('appends to existing array for 3+ duplicate tag names', () => {
      const result = parseFragment(
        '<card><set value="A" /><set value="B" /><set value="C" /></card>'
      ) as { set: { value: string }[] };
      expect(Array.isArray(result.set)).toBe(true);
      expect(result.set).toHaveLength(3);
      expect(result.set.map(s => s.value)).toEqual(['A', 'B', 'C']);
    });

    it('decodes XML entities and CDATA into leaf text', () => {
      const result = parseFragment('<card><name>A &amp; B &#x26; C</name><text><![CDATA[<rules> & text]]></text></card>');
      expect(result.name).toEqual({ value: 'A & B & C' });
      expect(result.text).toEqual({ value: '<rules> & text' });
    });
  });

  describe('parse (XML4 document)', () => {
    const cockatriceXml = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_carddatabase version="4">
  <info>
    <author>Cockatrice 2.x.x</author>
    <createdAt>2026-05-07T14:32:00Z</createdAt>
    <sourceUrl>https://www.mtgjson.com/api/v5/AllPrintings.json</sourceUrl>
    <sourceVersion>5.x.x</sourceVersion>
  </info>
  <formats>
    <format formatName="Standard">
      <minDeckSize>60</minDeckSize>
      <maxDeckSize>0</maxDeckSize>
      <maxSideboardSize>15</maxSideboardSize>
      <allowedCounts><count max="4">legal</count></allowedCounts>
      <exceptions>
        <exception>
          <maxCopies>unlimited</maxCopies>
          <cardCondition field="type" match="contains" value="Basic Land"/>
        </exception>
      </exceptions>
    </format>
  </formats>
  <sets>
    <set>
      <name>NEO</name>
      <longname>Kamigawa: Neon Dynasty</longname>
      <settype>Expansion</settype>
      <releasedate>2022-02-18</releasedate>
      <priority>1</priority>
    </set>
  </sets>
  <cards>
    <card>
      <name>Counterspell</name>
      <text>Counter target spell.</text>
      <prop>
        <type>Instant</type>
        <manacost>UU</manacost>
        <format-commander>legal</format-commander>
      </prop>
      <set picurl="https://example/counterspell.png" num="50" rarity="uncommon" uuid="abc">LEA</set>
      <related attach="transform">Back Half Name</related>
      <token>0</token>
      <tablerow>3</tablerow>
      <cipt>0</cipt>
    </card>
    <card>
      <name>Soldier Token</name>
      <prop>
        <type>Token Creature - Soldier</type>
        <pt>1/1</pt>
      </prop>
      <set>NEO</set>
      <token>1</token>
    </card>
  </cards>
</cockatrice_carddatabase>`;

    it('throws on malformed XML', () => {
      expect(() => cockatriceXmlParser.parse('<not valid')).toThrow();
    });

    it.each([
      '<html/>', '<cockatrice_carddatabase/>', '<cockatrice_carddatabase version="5"/>',
    ])('rejects an unsupported document: %s', xml => {
      expect(() => cockatriceXmlParser.parse(xml)).toThrow();
    });

    it.each([
      '<cards><card><name><nested/></name></card></cards>',
      '<cards><card><name>A</name><name>B</name></card></cards>',
      '<sets><set><name> </name></set></sets>',
      '<formats><format/></formats>',
      '<cards><card><name>A</name><set/></card></cards>',
    ])('rejects invalid record shapes: %s', content => {
      expect(() => cockatriceXmlParser.parse(`<cockatrice_carddatabase version="4">${content}</cockatrice_carddatabase>`)).toThrow();
    });

    it('reuses a validated preview only for the XML it came from', () => {
      const preview = cockatriceXmlParser.parseSource(cockatriceXml);
      expect(cockatriceXmlParser.parseSource(cockatriceXml, preview)).toBe(preview);
      expect(() => cockatriceXmlParser.parseSource('<html/>', preview)).toThrow();
      expect(() => cockatriceXmlParser.parseSource('<html/>', { cards: [], sets: [], tokens: [], formats: [] })).toThrow();
    });

    it('parses the <info> block into an Info DTO with import provenance', () => {
      const result = cockatriceXmlParser.parse(cockatriceXml);
      expect(result.info).toBeDefined();
      expect(result.info!.id).toBe('singleton');
      expect(result.info!.source).toBe('oracle-local-fs');
      expect(result.info!.author).toBe('Cockatrice 2.x.x');
      expect(result.info!.sourceUrl).toBe('https://www.mtgjson.com/api/v5/AllPrintings.json');
      expect(result.info!.sourceVersion).toBe('5.x.x');
      expect(result.info!.importedAt).toBeTruthy();
    });

    it('parses <formats> into typed Format objects', () => {
      const result = cockatriceXmlParser.parse(cockatriceXml);
      expect(result.formats).toHaveLength(1);
      const standard = result.formats![0];
      expect(standard.formatName).toBe('Standard');
      expect(standard.minDeckSize).toBe(60);
      expect(standard.maxDeckSize).toBe(0);
      expect(standard.maxSideboardSize).toBe(15);
      expect(standard.allowedCounts).toEqual([{ max: '4', label: 'legal' }]);
      expect(standard.exceptions).toEqual([
        { maxCopies: 'unlimited', conditions: [{ field: 'type', match: 'contains', value: 'Basic Land' }] },
      ]);
    });

    it('parses <sets> using set.name.value as the short code', () => {
      const result = cockatriceXmlParser.parse(cockatriceXml);
      expect(result.sets).toHaveLength(1);
      const neo = result.sets![0];
      expect(neo.name.value).toBe('NEO');
      expect(neo.longname?.value).toBe('Kamigawa: Neon Dynasty');
      expect(neo.settype?.value).toBe('Expansion');
      expect(neo.releasedate?.value).toBe('2022-02-18');
    });

    it('partitions <cards> into cards vs tokens via the <token> flag', () => {
      const result = cockatriceXmlParser.parse(cockatriceXml);
      expect(result.cards).toHaveLength(1);
      expect(result.tokens).toHaveLength(1);
      expect(result.cards![0].name.value).toBe('Counterspell');
      expect(result.tokens![0].name.value).toBe('Soldier Token');
    });

    it('skips cards without a name while importing the remaining records', () => {
      const parsed = cockatriceXmlParser.parse(`<cockatrice_carddatabase version="4"><cards>
        <card><text>Missing name</text><set>BAD</set></card>
        <card><name>Kept</name><set>GOOD</set></card>
      </cards></cockatrice_carddatabase>`);
      expect(parsed.cards).toEqual([expect.objectContaining({ name: { value: 'Kept' } })]);
    });

    it('keeps the first classification when a file defines a token before a card of the same name', () => {
      const parsed = cockatriceXmlParser.parse(`<cockatrice_carddatabase version="4"><cards>
        <card><name>Shared</name><token>1</token><set>A</set></card>
        <card><name>Shared</name><set>B</set></card>
      </cards></cockatrice_carddatabase>`);
      expect(parsed.cards).toBeUndefined();
      expect(parsed.tokens).toHaveLength(2);
      expect(parsed.tokens?.[0].token?.value).toBe('1');
    });

    it('passes <prop> through structurally without enumerating its keys', () => {
      const result = cockatriceXmlParser.parse(cockatriceXml);
      const counterspell = result.cards![0];
      // dynamic format-{name} elements survive
      expect((counterspell.prop!.value as Record<string, { value: string }>)['format-commander'].value).toBe('legal');
    });

    it('captures <set> attributes (picurl, num, rarity, uuid) on the printing', () => {
      const result = cockatriceXmlParser.parse(cockatriceXml);
      const counterspell = result.cards![0];
      // Single <set> stays an object (parser only collapses on duplicates)
      const printing = counterspell.set as unknown as { value: string; picurl: string; num: string; rarity: string; uuid: string };
      expect(printing.value).toBe('LEA');
      expect(printing.picurl).toBe('https://example/counterspell.png');
      expect(printing.num).toBe('50');
      expect(printing.rarity).toBe('uncommon');
      expect(printing.uuid).toBe('abc');
    });

    it('captures <related> attach attribute for transform/meld relations', () => {
      const result = cockatriceXmlParser.parse(cockatriceXml);
      const counterspell = result.cards![0];
      const related = counterspell.related as unknown as { value: string; attach: string };
      expect(related.value).toBe('Back Half Name');
      expect(related.attach).toBe('transform');
    });

    it('treats <card> children of legacy <cockatrice_tokens> root as tokens', () => {
      const legacyTokens = `<?xml version="1.0"?>
<cockatrice_tokens>
  <card>
    <name value="Soldier" />
    <set value="M21" />
  </card>
  <card>
    <name value="Treasure" />
  </card>
</cockatrice_tokens>`;
      const result = cockatriceXmlParser.parse(legacyTokens);
      expect(result.tokens).toHaveLength(2);
      expect(result.cards).toBeUndefined();
      expect(result.tokens![0].name.value).toBe('Soldier');
    });

    it('returns an empty result for a well-formed but empty document', () => {
      const empty = '<?xml version="1.0"?><cockatrice_carddatabase version="4"></cockatrice_carddatabase>';
      const result = cockatriceXmlParser.parse(empty);
      expect(result.info).toBeUndefined();
      expect(result.formats).toBeUndefined();
      expect(result.sets).toBeUndefined();
      expect(result.cards).toBeUndefined();
      expect(result.tokens).toBeUndefined();
    });
  });
});
