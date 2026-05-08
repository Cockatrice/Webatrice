/**
 * Reads user-supplied Oracle output (cards.xml / tokens.xml / spoiler.xml)
 * from the OS via `File` objects (drag-drop or `<input type="file">`), routes
 * them through `cockatriceXmlParser`, and persists the result.
 *
 * No state is persisted across imports: by deliberate design the user
 * re-picks files each time. This keeps the UI identical across browsers (no
 * silent re-reads via FileSystemHandle on Chromium) and matches an infrequent
 * (typically per-MTG-set-release, monthly) workflow.
 */

import { App } from '@app/types';

import { cockatriceXmlParser } from './CockatriceXmlParser';
import { CardDTO, SetDTO, TokenDTO, FormatDTO, InfoDTO } from './dexie';

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

      // Last-info-wins: typically only cards.xml carries <info>; if multiple
      // files do, the latest read provides the provenance row.
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
