import { App } from '@app/types';

import { CardDTO, SetDTO, TokenDTO, FormatDTO, InfoDTO } from '@app/services';

import { cockatriceXmlParser } from './CockatriceXmlParser';

const ACCEPTED_FILENAME = /^(cards|tokens|spoiler)\.xml$/i;

export interface IngestResult {
  cards: App.Card[];
  sets: App.Set[];
  tokens: App.Token[];
  formats: App.Format[];
  info?: App.Info;
  acceptedFiles: string[];
  skippedFiles: string[];
}

export interface PersistResult {
  cards: number;
  sets: number;
  tokens: number;
  formats: number;
  info: boolean;
}

class LocalOracleImportService {
  async ingest(files: File[]): Promise<IngestResult> {
    const result: IngestResult = {
      cards: [],
      sets: [],
      tokens: [],
      formats: [],
      acceptedFiles: [],
      skippedFiles: [],
    };

    for (const file of files) {
      if (!ACCEPTED_FILENAME.test(file.name)) {
        result.skippedFiles.push(file.name);
        continue;
      }

      const text = await file.text();
      const parsed = cockatriceXmlParser.parse(text);

      result.acceptedFiles.push(file.name);

      if (parsed.info) {
        result.info = parsed.info;
      }
      if (parsed.cards) {
        result.cards.push(...parsed.cards);
      }
      if (parsed.sets) {
        result.sets.push(...parsed.sets);
      }
      if (parsed.tokens) {
        result.tokens.push(...parsed.tokens);
      }
      if (parsed.formats) {
        result.formats.push(...parsed.formats);
      }
    }

    return result;
  }

  async persist(parsed: Omit<IngestResult, 'acceptedFiles' | 'skippedFiles'>): Promise<PersistResult> {
    if (parsed.cards.length) {
      await CardDTO.bulkAdd(parsed.cards as CardDTO[]);
    }
    if (parsed.sets.length) {
      await SetDTO.bulkAdd(parsed.sets as SetDTO[]);
    }
    if (parsed.tokens.length) {
      await TokenDTO.bulkAdd(parsed.tokens as TokenDTO[]);
    }
    if (parsed.formats.length) {
      await FormatDTO.bulkAdd(parsed.formats as FormatDTO[]);
    }

    if (parsed.info) {
      await new InfoDTO(parsed.info).save();
    }

    return {
      cards: parsed.cards.length,
      sets: parsed.sets.length,
      tokens: parsed.tokens.length,
      formats: parsed.formats.length,
      info: !!parsed.info,
    };
  }
}

export const localOracleImportService = new LocalOracleImportService();
