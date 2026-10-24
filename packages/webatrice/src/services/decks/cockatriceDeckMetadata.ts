import type { DeckMeta } from '@app/types';

const CURRENT_VERSION = 1 as const;

export function defaultMeta(): DeckMeta {
  return {
    v: CURRENT_VERSION,
    updatedAt: new Date().toISOString(),
  };
}

const TRAILER_PREFIX = '[webatrice] ';

export function parseMeta(commentsText: string | null | undefined): DeckMeta {
  const raw = commentsText ?? '';
  const text = raw.trim();
  if (!text) {
    return defaultMeta();
  }

  if (text.startsWith('{')) {
    const legacy = parseJsonMeta(text);
    if (legacy) {
      return legacy;
    }
  }

  const lines = raw.replace(/\s+$/, '').split(/\r?\n/);
  const last = lines[lines.length - 1];
  if (last.startsWith(TRAILER_PREFIX)) {
    const machine = parseJsonMeta(last.slice(TRAILER_PREFIX.length));
    if (machine) {
      const description = lines.slice(0, -1).join('\n').replace(/\s+$/, '');
      const { description: _legacyDescription, ...rest } = machine;
      return description ? { ...rest, description } : rest;
    }
  }

  return { ...defaultMeta(), description: raw };
}

export function serializeMeta(meta: DeckMeta): string {
  const description = meta.description ?? '';
  const machine: Partial<DeckMeta> = {};
  if (meta.priceUsd !== undefined) {
    machine.priceUsd = meta.priceUsd;
  }
  if (meta.priceMissingCount !== undefined) {
    machine.priceMissingCount = meta.priceMissingCount;
  }
  if (meta.bracketLevel !== undefined) {
    machine.bracketLevel = meta.bracketLevel;
  }
  if (meta.commanders?.length) {
    machine.commanders = meta.commanders;
  }
  if (Object.keys(machine).length === 0) {
    return description;
  }
  const trailer = TRAILER_PREFIX + JSON.stringify({ v: meta.v, updatedAt: meta.updatedAt, ...machine });
  const body = description.replace(/\s+$/, '');
  return body ? `${body}\n\n${trailer}` : trailer;
}

function parseJsonMeta(text: string): DeckMeta | null {
  try {
    return migrate(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Convenience: return a copy with `updatedAt` bumped to now. */
export function touchMeta(meta: DeckMeta): DeckMeta {
  return { ...meta, updatedAt: new Date().toISOString() };
}

/**
 * Migrate raw parsed JSON to the current schema version. Currently
 * there's only v1 — future migrations add cases here. Returns `null`
 * if the payload doesn't look like a webatrice meta at all (so the
 * caller can fall through to the human-comments case).
 */
function migrate(raw: unknown): DeckMeta | null {
  if (!isRecord(raw) || typeof raw.v !== 'number') {
    return null;
  }

  // v1 → v1: no-op, just validate + coerce shape.
  if (raw.v === 1) {
    const out: DeckMeta = {
      v: 1,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    };
    if (typeof raw.description === 'string') {
      out.description = raw.description;
    }
    if (typeof raw.priceUsd === 'number') {
      out.priceUsd = raw.priceUsd;
    }
    if (typeof raw.priceMissingCount === 'number') {
      out.priceMissingCount = raw.priceMissingCount;
    }
    if (
      typeof raw.bracketLevel === 'number' &&
      raw.bracketLevel >= 1 &&
      raw.bracketLevel <= 5
    ) {
      out.bracketLevel = raw.bracketLevel;
    }
    if (Array.isArray(raw.commanders)) {
      const names = raw.commanders.filter(
        (n): n is string => typeof n === 'string' && n.trim().length > 0,
      );
      if (names.length > 0) {
        out.commanders = names;
      }
    }
    return out;
  }

  // Unknown newer version → best-effort read, drop unrecognized fields.
  // (Older client seeing a v2 deck: keep the timestamps, discard the rest.)
  if (typeof raw.v === 'number' && raw.v > 1 && typeof raw.updatedAt === 'string') {
    return { v: 1, updatedAt: raw.updatedAt };
  }

  return null;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
