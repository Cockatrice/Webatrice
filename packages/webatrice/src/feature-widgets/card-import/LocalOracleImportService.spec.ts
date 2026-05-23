import { CardDTO, FormatDTO, InfoDTO, SetDTO, TokenDTO } from '@app/services';

import { localOracleImportService } from './LocalOracleImportService';

const oracleCardsXml = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_carddatabase version="4">
  <info>
    <author>Cockatrice 2.9.0</author>
    <createdAt>2026-05-07T14:32:00Z</createdAt>
    <sourceUrl>https://www.mtgjson.com/api/v5/AllPrintings.json</sourceUrl>
    <sourceVersion>5.2.0</sourceVersion>
  </info>
  <formats>
    <format formatName="Standard">
      <minDeckSize>60</minDeckSize>
    </format>
  </formats>
  <sets>
    <set>
      <name>NEO</name>
      <longname>Kamigawa: Neon Dynasty</longname>
    </set>
  </sets>
  <cards>
    <card>
      <name>Counterspell</name>
      <set>LEA</set>
      <token>0</token>
    </card>
  </cards>
</cockatrice_carddatabase>`;

const oracleTokensXml = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_carddatabase version="4">
  <cards>
    <card>
      <name>Soldier</name>
      <set>M21</set>
      <token>1</token>
    </card>
  </cards>
</cockatrice_carddatabase>`;

function fakeFile(name: string, content: string): File {
  return new File([content], name, { type: 'application/xml' });
}

describe('LocalOracleImportService', () => {
  describe('ingest', () => {
    it('reads an accepted file by filename and parses its content', async () => {
      const result = await localOracleImportService.ingest([fakeFile('cards.xml', oracleCardsXml)]);

      expect(result.acceptedFiles).toEqual(['cards.xml']);
      expect(result.skippedFiles).toEqual([]);
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].name.value).toBe('Counterspell');
      expect(result.sets).toHaveLength(1);
      expect(result.formats).toHaveLength(1);
      expect(result.info?.author).toBe('Cockatrice 2.9.0');
      expect(result.info?.source).toBe('oracle-local-fs');
    });

    it('combines cards.xml and tokens.xml into a single result', async () => {
      const result = await localOracleImportService.ingest([
        fakeFile('cards.xml', oracleCardsXml),
        fakeFile('tokens.xml', oracleTokensXml),
      ]);

      expect(result.acceptedFiles.sort()).toEqual(['cards.xml', 'tokens.xml']);
      expect(result.cards).toHaveLength(1);
      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0].name.value).toBe('Soldier');
    });

    it('skips files whose names are not cards.xml / tokens.xml / spoiler.xml', async () => {
      const result = await localOracleImportService.ingest([
        fakeFile('cards.xml', oracleCardsXml),
        fakeFile('not-oracle.xml', '<x />'),
        fakeFile('cards.json', '{}'),
      ]);

      expect(result.acceptedFiles).toEqual(['cards.xml']);
      expect(result.skippedFiles.sort()).toEqual(['cards.json', 'not-oracle.xml']);
    });

    it('accepts spoiler.xml', async () => {
      const result = await localOracleImportService.ingest([fakeFile('spoiler.xml', oracleCardsXml)]);
      expect(result.acceptedFiles).toEqual(['spoiler.xml']);
    });

    it('matches filenames case-insensitively (Windows often capitalizes)', async () => {
      const result = await localOracleImportService.ingest([fakeFile('Cards.XML', oracleCardsXml)]);
      expect(result.acceptedFiles).toEqual(['Cards.XML']);
    });

    it('marks the import provenance source as oracle-local-fs', async () => {
      const result = await localOracleImportService.ingest([fakeFile('cards.xml', oracleCardsXml)]);
      expect(result.info?.source).toBe('oracle-local-fs');
      expect(result.info?.id).toBe('singleton');
    });

    it('returns empty arrays when no input files are accepted', async () => {
      const result = await localOracleImportService.ingest([fakeFile('readme.txt', 'hello')]);
      expect(result.acceptedFiles).toEqual([]);
      expect(result.cards).toEqual([]);
      expect(result.sets).toEqual([]);
      expect(result.tokens).toEqual([]);
      expect(result.formats).toEqual([]);
      expect(result.info).toBeUndefined();
    });

    it('does not dedup cards that appear in both cards.xml and spoiler.xml', async () => {
      const spoilerCardsXml = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_carddatabase version="4">
  <info>
    <author>Spoiler Source</author>
  </info>
  <cards>
    <card>
      <name>Counterspell</name>
      <set>STA</set>
      <token>0</token>
    </card>
  </cards>
</cockatrice_carddatabase>`;

      const result = await localOracleImportService.ingest([
        fakeFile('cards.xml', oracleCardsXml),
        fakeFile('spoiler.xml', spoilerCardsXml),
      ]);

      expect(result.acceptedFiles.sort()).toEqual(['cards.xml', 'spoiler.xml']);
      expect(result.cards).toHaveLength(2);
      expect(result.cards.map(c => c.name.value)).toEqual(['Counterspell', 'Counterspell']);
    });

    it('overwrites info with the last accepted file (last-write-wins)', async () => {
      const spoilerInfoXml = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_carddatabase version="4">
  <info>
    <author>Spoiler Source</author>
  </info>
  <cards>
    <card>
      <name>Lightning Bolt</name>
      <set>LEA</set>
      <token>0</token>
    </card>
  </cards>
</cockatrice_carddatabase>`;

      const result = await localOracleImportService.ingest([
        fakeFile('cards.xml', oracleCardsXml),
        fakeFile('spoiler.xml', spoilerInfoXml),
      ]);

      expect(result.info?.author).toBe('Spoiler Source');
      expect(result.info?.source).toBe('oracle-local-fs');
    });

    it('rejects when an accepted file contains malformed XML', async () => {
      await expect(
        localOracleImportService.ingest([fakeFile('cards.xml', '<not closed')]),
      ).rejects.toThrow('Cockatrice XML is malformed');
    });

    it('accepts a well-formed file that has no card/set/token children', async () => {
      const emptyDbXml = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_carddatabase version="4">
  <cards></cards>
</cockatrice_carddatabase>`;

      const result = await localOracleImportService.ingest([fakeFile('cards.xml', emptyDbXml)]);

      expect(result.acceptedFiles).toEqual(['cards.xml']);
      expect(result.skippedFiles).toEqual([]);
      expect(result.cards).toEqual([]);
      expect(result.sets).toEqual([]);
      expect(result.tokens).toEqual([]);
      expect(result.formats).toEqual([]);
      expect(result.info).toBeUndefined();
    });

    it('ingests the XML and lists the unrecognized text file as skipped', async () => {
      const result = await localOracleImportService.ingest([
        fakeFile('cards.xml', oracleCardsXml),
        fakeFile('notes.txt', 'reminder: re-export tokens later'),
      ]);

      expect(result.acceptedFiles).toEqual(['cards.xml']);
      expect(result.skippedFiles).toEqual(['notes.txt']);
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].name.value).toBe('Counterspell');
    });
  });

  describe('persist', () => {
    it('forwards a large card payload to CardDTO.bulkAdd in a single call without chunking', async () => {
      const bulkAddSpy = vi.spyOn(CardDTO, 'bulkAdd').mockResolvedValue('cards-key');
      vi.spyOn(SetDTO, 'bulkAdd').mockResolvedValue('sets-key');
      vi.spyOn(TokenDTO, 'bulkAdd').mockResolvedValue('tokens-key');
      vi.spyOn(FormatDTO, 'bulkAdd').mockResolvedValue('formats-key');
      const infoSave = vi.spyOn(InfoDTO.prototype, 'save').mockResolvedValue('info-key');

      const cards = Array.from({ length: 5000 }, (_, i) => ({
        name: { value: `Card ${i}` },
      })) as unknown as Parameters<typeof localOracleImportService.persist>[0]['cards'];

      const result = await localOracleImportService.persist({
        cards,
        sets: [],
        tokens: [],
        formats: [],
      });

      expect(bulkAddSpy).toHaveBeenCalledTimes(1);
      expect(bulkAddSpy.mock.calls[0][0]).toHaveLength(5000);
      expect(result.cards).toBe(5000);
      expect(result.info).toBe(false);
      expect(infoSave).not.toHaveBeenCalled();
    });
  });
});
