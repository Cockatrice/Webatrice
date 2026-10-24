import { z } from 'zod';
import { chunkForCollection, postCollection, scryfallSearchUrl } from '../../services/scryfall/client';
import { scheduleScryfallRequest, ScryfallRateLimitError } from '../../services/scryfall/scheduler';

import type { DeckCard } from './types';

export type BracketSource = 'gameChangers' | 'oracleText' | 'combos';

export type SourceFailure =
  | { kind: 'timeout' }
  | { kind: 'network' }
  | { kind: 'http'; status: number }
  | { kind: 'malformed' };

export type SourceResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'partial'; data: T; failure: SourceFailure; missing: number; total: number }
  | { status: 'unavailable'; failure: SourceFailure };

export const BRACKET_SOURCE_TIMEOUT_MS = 15_000;

const GAME_CHANGERS_URL = scryfallSearchUrl('is:gamechanger', 'order=name&unique=cards');
const SPELLBOOK_URL = 'https://backend.commanderspellbook.com/find-my-combos/';

const MALFORMED: SourceFailure = { kind: 'malformed' };

class SourceError extends Error {
  constructor(readonly failure: SourceFailure) {
    super(failure.kind);
  }
}

async function fetchJson(send: (signal: AbortSignal) => Promise<Response>): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BRACKET_SOURCE_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await send(controller.signal);
    } catch (e) {
      if (e instanceof ScryfallRateLimitError) {
        throw new SourceError({ kind: 'http', status: e.status });
      }
      throw new SourceError({ kind: (e as { name?: string })?.name === 'AbortError' ? 'timeout' : 'network' });
    }
    if (!res.ok) {
      throw new SourceError({ kind: 'http', status: res.status });
    }
    try {
      return await res.json();
    } catch (e) {
      throw new SourceError((e as { name?: string })?.name === 'AbortError' ? { kind: 'timeout' } : MALFORMED);
    }
  } finally {
    clearTimeout(timer);
  }
}

function failureOf(e: unknown): SourceFailure {
  return e instanceof SourceError ? e.failure : MALFORMED;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// ---------- Scryfall: Game Changers list ----------

let gameChangersCache: Set<string> | null = null;
let gameChangersInFlight: Promise<SourceResult<Set<string>>> | null = null;

export async function fetchGameChangers(): Promise<SourceResult<Set<string>>> {
  if (gameChangersCache) {
    return { status: 'ok', data: gameChangersCache };
  }
  if (gameChangersInFlight) {
    return gameChangersInFlight;
  }
  gameChangersInFlight = (async (): Promise<SourceResult<Set<string>>> => {
    try {
      const body = await fetchJson((signal) => scheduleScryfallRequest(GAME_CHANGERS_URL, { signal }));
      if (!isRecord(body) || !Array.isArray(body.data)) {
        return { status: 'unavailable', failure: MALFORMED };
      }
      const names = new Set<string>();
      let missing = 0;
      for (const c of body.data) {
        if (isRecord(c) && typeof c.name === 'string' && c.name.trim()) {
          names.add(c.name);
        } else {
          missing++;
        }
      }
      if (names.size === 0) {
        return { status: 'unavailable', failure: MALFORMED };
      }
      if (missing > 0) {
        return { status: 'partial', data: names, failure: MALFORMED, missing, total: body.data.length };
      }
      gameChangersCache = names;
      return { status: 'ok', data: names };
    } catch (e) {
      return { status: 'unavailable', failure: failureOf(e) };
    } finally {
      gameChangersInFlight = null;
    }
  })();
  return gameChangersInFlight;
}

interface ScryfallCollectionCard {
  name: string;
  oracle_text?: string;
  card_faces?: Array<{ oracle_text?: string }>;
}

const oracleCache = new Map<string, string>();
const oracleInFlight = new Map<string, Promise<SourceFailure | null>>();

export async function fetchOracleText(names: string[]): Promise<SourceResult<Map<string, string>>> {
  const uniqueLower = Array.from(new Set(names.map((n) => n.toLowerCase())));
  const originalByLower = new Map<string, string>();
  for (const n of names) {
    originalByLower.set(n.toLowerCase(), n);
  }

  const need: string[] = [];
  const awaiting: Array<Promise<SourceFailure | null>> = [];
  for (const key of uniqueLower) {
    if (oracleCache.has(key)) {
      continue;
    }
    const pending = oracleInFlight.get(key);
    if (pending) {
      awaiting.push(pending);
    } else {
      need.push(key);
    }
  }

  const failures: SourceFailure[] = [];
  for (const chunk of chunkForCollection(need)) {
    const request = fetchOracleChunk(chunk, originalByLower);
    for (const k of chunk) {
      oracleInFlight.set(k, request);
    }
    try {
      const failure = await request;
      if (failure) {
        failures.push(failure);
      }
    } finally {
      for (const k of chunk) {
        oracleInFlight.delete(k);
      }
    }
  }
  for (const failure of await Promise.all(awaiting)) {
    if (failure) {
      failures.push(failure);
    }
  }

  const data = new Map<string, string>();
  for (const key of uniqueLower) {
    const text = oracleCache.get(key);
    if (text != null) {
      data.set(key, text);
    }
  }
  if (failures.length === 0) {
    return { status: 'ok', data };
  }
  if (data.size === 0) {
    return { status: 'unavailable', failure: failures[0] };
  }
  return {
    status: 'partial',
    data,
    failure: failures[0],
    missing: uniqueLower.length - data.size,
    total: uniqueLower.length,
  };
}

async function fetchOracleChunk(
  chunk: string[],
  originalByLower: Map<string, string>,
): Promise<SourceFailure | null> {
  try {
    const identifiers = chunk.map((k) => ({ name: originalByLower.get(k) ?? k }));
    const body = await fetchJson((signal) => postCollection(identifiers, signal));
    if (!isRecord(body) || !Array.isArray(body.data)) {
      return MALFORMED;
    }
    const cards = body.data as ScryfallCollectionCard[];
    if (!cards.every((card) => typeof card?.name === 'string')) {
      return MALFORMED;
    }
    const returned = new Set<string>();
    for (const card of cards) {
      const combined =
        card.oracle_text ??
        (card.card_faces ?? []).map((f) => f.oracle_text ?? '').filter(Boolean).join('\n');
      const key = card.name.toLowerCase();
      oracleCache.set(key, combined);
      returned.add(key);
      const firstFace = key.split(' // ')[0];
      if (firstFace !== key) {
        oracleCache.set(firstFace, combined);
        returned.add(firstFace);
      }
    }
    if (Array.isArray(body.not_found)) {
      for (const identifier of body.not_found) {
        if (isRecord(identifier) && typeof identifier.name === 'string') {
          const key = identifier.name.toLowerCase();
          if (chunk.includes(key) && !returned.has(key)) {
            oracleCache.set(key, '');
            returned.add(key);
          }
        }
      }
    }
    return chunk.every((key) => returned.has(key)) ? null : MALFORMED;
  } catch (e) {
    return failureOf(e);
  }
}

// ---------- Commander Spellbook: combos ----------

export interface SpellbookCombo {
  id: string;
  uses?: Array<{
    card: { name: string };
    quantity?: number;
    zoneLocations?: string[];
  }>;
  produces?: Array<{ feature?: { id: number }; quantity?: number }>;
  requires?: Array<{
    template?: { id: number };
    quantity?: number;
    zoneLocations?: string[];
  }>;
  manaValueNeeded?: number;
  notablePrerequisites?: string;
}

const spellbookComboSchema = z.object({
  id: z.string().refine((value) => value.trim().length > 0),
  uses: z.array(z.object({
    card: z.object({ name: z.string().refine((value) => value.trim().length > 0) }),
    quantity: z.number().optional(),
    zoneLocations: z.array(z.string()).optional(),
  })).optional(),
  produces: z.array(z.object({
    feature: z.object({ id: z.number() }).optional(),
    quantity: z.number().optional(),
  })).optional(),
  requires: z.array(z.object({
    template: z.object({ id: z.number() }).optional(),
    quantity: z.number().optional(),
    zoneLocations: z.array(z.string()).optional(),
  })).optional(),
  manaValueNeeded: z.number().optional(),
  notablePrerequisites: z.string().optional(),
});

export async function fetchSpellbookCombos(cards: DeckCard[]): Promise<SourceResult<SpellbookCombo[]>> {
  const main = new Map<string, number>();
  const commanders = new Map<string, number>();
  for (const c of cards) {
    if (c.category !== 'main') {
      continue;
    }
    const list = c.isCommander ? commanders : main;
    list.set(c.name, (list.get(c.name) ?? 0) + c.quantity);
  }
  if (main.size === 0 && commanders.size === 0) {
    return { status: 'ok', data: [] };
  }
  const toRequest = (list: Map<string, number>) => Array.from(list, ([card, quantity]) => ({ card, quantity }));
  try {
    const body = await fetchJson((signal) => fetch(SPELLBOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ main: toRequest(main), commanders: toRequest(commanders) }),
      signal,
    }));
    if (!isRecord(body) || !isRecord(body.results)) {
      return { status: 'unavailable', failure: MALFORMED };
    }
    const included = body.results.included;
    if (!Array.isArray(included)) {
      return { status: 'unavailable', failure: MALFORMED };
    }
    const data: SpellbookCombo[] = [];
    for (const entry of included) {
      const parsed = spellbookComboSchema.safeParse(entry);
      if (parsed.success) {
        data.push(parsed.data);
      }
    }
    const missing = included.length - data.length;
    if (missing > 0) {
      return data.length > 0
        ? { status: 'partial', data, failure: MALFORMED, missing, total: included.length }
        : { status: 'unavailable', failure: MALFORMED };
    }
    return { status: 'ok', data };
  } catch (e) {
    return { status: 'unavailable', failure: failureOf(e) };
  }
}

export function clearBracketSourceCaches(): void {
  gameChangersCache = null;
  gameChangersInFlight = null;
  oracleCache.clear();
  oracleInFlight.clear();
}
