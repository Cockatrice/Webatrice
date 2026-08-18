import type { DeckMeta } from './types';

/**
 * Codec for the JSON metadata blob that lives inside a `.cod`'s
 * `<comments>` element. Webatrice owns the entire comments field:
 * on save we always write our JSON. On load we distinguish three
 * cases:
 *
 *   1. Empty comments        → default meta with `updatedAt = now`
 *   2. Our JSON (has `v` +   → parsed + migrated to the current
 *      matches our shape)      schema version
 *   3. Anything else         → treat the raw text as human-authored
 *      (a Cockatrice desktop   `description` and wrap it in default
 *      user's notes, plain     meta. First save then rewrites it as
 *      text, malformed JSON)   JSON — preserving the description.
 *
 * This "first-load rewrites the comments" behavior is intentional:
 * once webatrice touches a deck the comments become a machine-managed
 * JSON blob. Cockatrice desktop still opens the file fine — it just
 * sees a comment string it doesn't interpret.
 */

const CURRENT_VERSION = 1 as const;

export function defaultMeta(): DeckMeta {
  return {
    v: CURRENT_VERSION,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Parse the raw contents of a `.cod` `<comments>` element into a
 * DeckMeta. Always returns a valid meta — the fallback paths just
 * fill in defaults. `commentsText` may be `null`/`undefined` if the
 * element didn't exist.
 */
export function parseMeta(commentsText: string | null | undefined): DeckMeta {
  const text = commentsText?.trim();
  if (!text) return defaultMeta();

  // Case 2: our JSON blob.
  if (text.startsWith('{')) {
    try {
      const raw: unknown = JSON.parse(text);
      const migrated = migrate(raw);
      if (migrated) return migrated;
    } catch {
      // fallthrough — malformed JSON: treat as description
    }
  }

  // Case 3: human-authored comments. Preserve them as description so
  // the next save doesn't destroy the user's notes.
  return { ...defaultMeta(), description: text };
}

/** Serialize a DeckMeta to the string that will be written back into
 *  the `<comments>` element. Pretty-prints with 2-space indent so a
 *  human peeking at the raw file can read it. */
export function serializeMeta(meta: DeckMeta): string {
  return JSON.stringify(meta, null, 2);
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
  if (!isRecord(raw) || typeof raw.v !== 'number') return null;

  // v1 → v1: no-op, just validate + coerce shape.
  if (raw.v === 1) {
    const out: DeckMeta = {
      v: 1,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    };
    if (typeof raw.description === 'string') out.description = raw.description;
    if (typeof raw.priceUsd === 'number') out.priceUsd = raw.priceUsd;
    if (typeof raw.priceMissingCount === 'number') out.priceMissingCount = raw.priceMissingCount;
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
