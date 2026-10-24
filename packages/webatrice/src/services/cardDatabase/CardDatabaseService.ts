import { CardDataSettingsDTO, CardSourceDTO, SetPreferenceDTO } from '../dexie/DexieDTOs';

import { dexieService } from '../dexie/DexieService';

import type {

  CardSource,

  CardSourceKind,

  CardSourceOrigin,

  CardSourcePayload,

  CardSourceRecords,

  Info,

  Set,

  SetPreference,

  Token,

} from '../dexie/types';

import { refreshCardDataPreferences } from './cardDataPreferences';

import { cockatriceXmlParser } from './CockatriceXmlParser';

import {

  CardSourceId,

  mergeCardSources,

  nextCustomOrder,

  sortSourcesByLoadOrder,

  sourceIdFor,

  sourceKindForFile,

} from './mergeCardSources';

import { enableAllUnknown, markAllAsKnown, reconcileSetPreferences } from './setPriority';



export const CUSTOM_TOKEN_SET: Set = {

  name: { value: 'TK' },

  longname: { value: 'Dummy set containing tokens' },

  settype: { value: 'Tokens' },

};



export interface CardDatabaseSummary {

  cards: number;

  sets: number;

  tokens: number;

  formats: number;

}



export interface RebuildResult {

  summary: CardDatabaseSummary;

  unknownSets: string[];

  allNewSetsEnabled: boolean;

}



export interface NewSourceInput {

  fileName: string;

  xml: string;

  origin: CardSourceOrigin;

  url?: string;

  kind?: CardSourceKind;

  records?: CardSourceRecords;

  replaces?: string;

}



export interface PendingSource {

  source: CardSource;

  payload: CardSourcePayload;

}



const LEGACY_FILE_KINDS: readonly CardSourceKind[] = ['main', 'tokens', 'spoiler'];



export type UnknownSetsAnswer = 'enable' | 'enable-always' | 'keep-disabled';



function countsOf(records: CardSourceRecords) {

  return {

    cards: records.cards.length,

    sets: records.sets.length,

    tokens: records.tokens.length,

    formats: records.formats.length,

  };

}



export class TokenNameConflictError extends Error {}



class CardDatabaseService {

  private parsedCache = new Map<string, { importedAt: string; records: CardSourceRecords }>();



  createSource(input: NewSourceInput, existing: readonly CardSource[]): PendingSource {

    const kind = input.kind ?? sourceKindForFile(input.fileName);

    const replaced = input.replaces ? existing.find((source) => source.id === input.replaces) : undefined;

    const order = kind === 'custom' ? replaced?.order ?? nextCustomOrder(existing) : 0;

    const records = cockatriceXmlParser.parseSource(input.xml, input.records);

    const importedAt = new Date().toISOString();

    const id = sourceIdFor(kind, input.fileName, order);

    this.parsedCache.set(id, { importedAt, records });

    return {

      source: {

        id,

        kind,

        fileName: input.fileName,

        origin: input.origin,

        url: input.url,

        order,

        importedAt,

        counts: countsOf(records),

        sourceVersion: records.info?.sourceVersion,

        author: records.info?.author,

        createdAt: records.info?.createdAt,

      },

      payload: { id, xml: input.xml },

    };

  }



  async listSources(): Promise<CardSource[]> {

    return sortSourcesByLoadOrder(await CardSourceDTO.getAll());

  }



  async hasSourceXml(id: string, xml: string): Promise<boolean> {

    const payload = await CardSourceDTO.getPayload(id);

    return payload?.xml === xml;

  }



  async summary(): Promise<CardDatabaseSummary> {

    const [cards, sets, tokens, formats] = await Promise.all([

      dexieService.cards.count(),

      dexieService.sets.count(),

      dexieService.tokens.count(),

      dexieService.formats.count(),

    ]);

    return { cards, sets, tokens, formats };

  }



  async addSources(inputs: readonly NewSourceInput[]): Promise<RebuildResult> {

    const parsed = inputs.map(input => ({ ...input, records: cockatriceXmlParser.parseSource(input.xml, input.records) }));

    const replacedIds = inputs.flatMap((input) => (input.replaces ? [input.replaces] : []));

    replacedIds.forEach((id) => this.parsedCache.delete(id));

    return this.applySources(parsed, replacedIds);

  }



  async removeSource(id: string): Promise<RebuildResult> {

    this.parsedCache.delete(id);

    return this.applySources([], [id]);

  }



  reload(): Promise<RebuildResult> {

    this.parsedCache.clear();

    return this.applySources([], []);

  }



  private async recordsOf(source: CardSource, pending?: CardSourcePayload): Promise<{

    records: CardSourceRecords;

    materialized?: CardSourcePayload;

  }> {

    const cached = this.parsedCache.get(source.id);

    if (cached && cached.importedAt === source.importedAt) {

      return { records: cached.records };

    }

    const payload = pending ?? await CardSourceDTO.getPayload(source.id);

    if (!payload && source.kind === 'legacy') {

      const records = await this.readLegacyTables();

      return { records, materialized: { id: source.id, records } };

    }

    const records = payload?.records ?? cockatriceXmlParser.parseSource(payload?.xml ?? '');

    this.parsedCache.set(source.id, { importedAt: source.importedAt, records });

    return { records };

  }



  private async readLegacyTables(): Promise<CardSourceRecords> {

    const [cards, sets, tokens, formats, info, userTokens] = await Promise.all([

      dexieService.cards.toArray() as Promise<CardSourceRecords['cards']>,

      dexieService.sets.toArray() as Promise<Set[]>,

      dexieService.tokens.toArray() as Promise<Token[]>,

      dexieService.formats.toArray() as Promise<CardSourceRecords['formats']>,

      dexieService.info.toCollection().first() as Promise<Info | undefined>,

      CardSourceDTO.getPayload(CardSourceId.USER_TOKENS),

    ]);

    const editorTokens = new globalThis.Set((userTokens?.records?.tokens ?? []).map((token) => token.name.value));

    return {

      cards,

      sets,

      tokens: tokens.filter((token) => !editorTokens.has(token.name.value)),

      formats,

      info,

    };

  }



  private async applySources(inputs: readonly NewSourceInput[], removedIds: readonly string[]): Promise<RebuildResult> {

    const result = await dexieService.cardDataTransaction(async () => {

      const [stored, preferences, settings] = await Promise.all([

        CardSourceDTO.getAll(),

        SetPreferenceDTO.getAll(),

        CardDataSettingsDTO.get(),

      ]);



      const added: PendingSource[] = [];

      for (const input of inputs) {

        added.push(this.createSource(input, [...stored, ...added.map(pending => pending.source)]));

      }



      const replaced = new globalThis.Set<string>([...removedIds, ...added.map((pending) => pending.source.id)]);

      let sources = sortSourcesByLoadOrder([

        ...stored.filter((s) => !replaced.has(s.id)),

        ...added.map((pending) => pending.source),

      ]);

      if (LEGACY_FILE_KINDS.every((kind) => sources.some((s) => s.kind === kind))) {

        replaced.add(CardSourceId.LEGACY);

        this.parsedCache.delete(CardSourceId.LEGACY);

        sources = sources.filter((s) => s.id !== CardSourceId.LEGACY);

      }



      const pendingPayloads = new Map(added.map((pending) => [pending.source.id, pending.payload]));

      const layers: CardSourceRecords[] = [];

      const materialized: CardSourcePayload[] = [];

      for (const source of sources) {

        const loaded = await this.recordsOf(source, pendingPayloads.get(source.id));

        layers.push(loaded.records);

        if (loaded.materialized) {

          materialized.push(loaded.materialized);

        }

      }



      const merged = mergeCardSources(layers);

      const reconciliation = reconcileSetPreferences(

        merged.sets,

        new Map(preferences.map((p) => [p.code, p])),

        settings.alwaysEnableNewSets,

      );

      const mainSource = sources.find((s) => s.kind === 'main' || s.kind === 'legacy');

      const info: Info | undefined = merged.info && mainSource

        ? {

          ...merged.info,

          source: mainSource.origin === 'url' ? 'remote' : 'oracle-local-fs',

          sourceUrl: mainSource.url ?? merged.info.sourceUrl,

          importedAt: mainSource.importedAt,

        }

        : undefined;



      await Promise.all([

        dexieService.cardSources.bulkDelete([...replaced]),

        dexieService.cardSourcePayloads.bulkDelete([...replaced]),

        dexieService.cards.clear(),

        dexieService.sets.clear(),

        dexieService.tokens.clear(),

        dexieService.formats.clear(),

        dexieService.info.clear(),

      ]);

      await Promise.all([

        dexieService.cardSources.bulkPut(added.map((pending) => pending.source)),

        dexieService.cardSourcePayloads.bulkPut([...added.map((pending) => pending.payload), ...materialized]),

        dexieService.cards.bulkPut(merged.cards),

        dexieService.sets.bulkPut(merged.sets),

        dexieService.tokens.bulkPut(merged.tokens),

        dexieService.formats.bulkPut(merged.formats),

        info ? dexieService.info.put(info) : Promise.resolve(),

        dexieService.setPreferences.bulkPut(reconciliation.changed),

      ]);



      return {

        summary: countsOf(merged),

        unknownSets: reconciliation.unknownSets,

        allNewSetsEnabled: reconciliation.allNewSetsEnabled,

      };

    });



    await refreshCardDataPreferences();

    return result;

  }



  async resolveUnknownSets(answer: UnknownSetsAnswer): Promise<void> {

    const [sets, preferences] = await Promise.all([

      dexieService.sets.toArray() as Promise<Set[]>,

      SetPreferenceDTO.getAll(),

    ]);

    const map = new Map(preferences.map((p) => [p.code, p]));

    const changed = answer === 'keep-disabled' ? markAllAsKnown(sets, map) : enableAllUnknown(sets, map);

    await SetPreferenceDTO.bulkPut(changed);

    if (answer === 'enable-always') {

      const settings = await CardDataSettingsDTO.get();

      settings.alwaysEnableNewSets = true;

      await settings.save();

    }

    await refreshCardDataPreferences();

  }



  async getSetInventory(): Promise<{ sets: Set[]; preferences: SetPreference[] }> {

    const [sets, preferences] = await Promise.all([

      dexieService.sets.toArray() as Promise<Set[]>,

      SetPreferenceDTO.getAll(),

    ]);

    return { sets, preferences };

  }



  async saveSetPreferences(preferences: readonly SetPreference[]): Promise<void> {

    await SetPreferenceDTO.bulkPut([...preferences]);

    await refreshCardDataPreferences();

  }



  async getPictureUrlTemplates(): Promise<string[]> {

    return (await CardDataSettingsDTO.get()).pictureUrlTemplates;

  }



  async savePictureUrlTemplates(templates: readonly string[]): Promise<void> {

    const settings = await CardDataSettingsDTO.get();

    settings.pictureUrlTemplates = [...templates];

    await settings.save();

    await refreshCardDataPreferences();

  }



  async recordUpdateCheck(at = new Date()): Promise<void> {

    const settings = await CardDataSettingsDTO.get();

    settings.lastUpdateCheck = at.toISOString();

    await settings.save();

  }



  async getLastUpdateCheck(): Promise<string | undefined> {

    return (await CardDataSettingsDTO.get()).lastUpdateCheck;

  }



  async getCustomTokens(): Promise<Token[]> {

    const payload = await CardSourceDTO.getPayload(CardSourceId.USER_TOKENS);

    return payload?.records?.tokens ?? [];

  }



  async isNameTaken(name: string): Promise<boolean> {

    const [card, token] = await Promise.all([

      dexieService.cards.where('name.value').equalsIgnoreCase(name).first(),

      dexieService.tokens.where('name.value').equalsIgnoreCase(name).first(),

    ]);

    return Boolean(card || token);

  }



  async saveCustomTokens(

    changed: readonly Token[], removedNames: readonly string[] = [], mode: 'upsert' | 'add' | 'update' = 'upsert',

  ): Promise<Token[]> {

    const tokens = await dexieService.cardDataTransaction(async () => {

      const current = await this.getCustomTokens();

      const byName = new Map(current.map(token => [token.name.value, token]));

      for (const token of changed) {

        if (mode === 'add' && await this.isNameTaken(token.name.value)) {

          throw new TokenNameConflictError(token.name.value);

        }

        if (mode === 'update' && !byName.has(token.name.value)) {

          throw new Error('The token was removed');

        }

        byName.set(token.name.value, token);

      }

      for (const name of removedNames) {

        byName.delete(name);

      }

      const tokens = [...byName.values()];

      const sets = tokens.length ? [CUSTOM_TOKEN_SET] : [];

      const records: CardSourceRecords = { cards: [], sets, tokens, formats: [] };

      const source: CardSource = {

        id: CardSourceId.USER_TOKENS,

        kind: 'user-tokens',

        fileName: 'TK.xml',

        origin: 'editor',

        order: 0,

        importedAt: new Date().toISOString(),

        counts: countsOf(records),

      };

      const code = CUSTOM_TOKEN_SET.name.value;

      await dexieService.tokens.bulkDelete([...removedNames]);

      await dexieService.tokens.bulkPut(changed.filter(token => !removedNames.includes(token.name.value)));

      if (tokens.length && !(await dexieService.sets.get(code))) {

        await dexieService.sets.put(CUSTOM_TOKEN_SET);

      }

      if (tokens.length && !(await dexieService.setPreferences.get(code))) {

        const sortKey = await dexieService.setPreferences.count();

        await dexieService.setPreferences.put({ code, sortKey, enabled: true, isKnown: true } satisfies SetPreference);

      }

      await dexieService.cardSources.put(source);

      await dexieService.cardSourcePayloads.put({ id: source.id, records } satisfies CardSourcePayload);

      this.parsedCache.delete(source.id);

      return tokens;

    });

    await refreshCardDataPreferences();

    return tokens;

  }

}



export const cardDatabaseService = new CardDatabaseService();

