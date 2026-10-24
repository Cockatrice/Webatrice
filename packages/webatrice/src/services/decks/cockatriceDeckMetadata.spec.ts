import type { DeckMeta } from '@app/types';

import { defaultMeta, parseMeta, serializeMeta, touchMeta } from './cockatriceDeckMetadata';

describe('parseMeta', () => {
  it('returns default meta when input is empty/whitespace/null/undefined', () => {
    for (const input of ['', '   ', '\n\t', null, undefined]) {
      const m = parseMeta(input);
      expect(m.v).toBe(1);
      expect(new Date(m.updatedAt).toString()).not.toBe('Invalid Date');
      expect(m.description).toBeUndefined();
    }
  });

  it('parses a valid v1 JSON blob', () => {
    const meta: DeckMeta = {
      v: 1,
      updatedAt: '2026-07-19T12:00:00.000Z',
      description: 'notes',
      priceUsd: 42.5,
      priceMissingCount: 3,
    };
    expect(parseMeta(JSON.stringify(meta))).toEqual(meta);
  });

  it('treats malformed JSON as a human description', () => {
    const m = parseMeta('{not valid json');
    expect(m.description).toBe('{not valid json');
  });

  it('treats non-JSON text as a human description', () => {
    const m = parseMeta('This is my Zur deck, please critique it.');
    expect(m.description).toBe('This is my Zur deck, please critique it.');
  });

  it('best-effort reads a newer version, dropping unknown fields', () => {
    const raw = JSON.stringify({
      v: 99,
      updatedAt: '2050-01-01T00:00:00.000Z',
      newField: 'ignored',
    });
    const m = parseMeta(raw);
    expect(m.v).toBe(1);
    expect(m.updatedAt).toBe('2050-01-01T00:00:00.000Z');
    // @ts-expect-error — the unknown field should not survive
    expect(m.newField).toBeUndefined();
  });

  it('coerces missing/invalid updatedAt in v1 to a fresh ISO string', () => {
    const raw = JSON.stringify({ v: 1 });
    const m = parseMeta(raw);
    expect(new Date(m.updatedAt).toString()).not.toBe('Invalid Date');
  });

  it('ignores non-number priceUsd', () => {
    const raw = JSON.stringify({ v: 1, updatedAt: '2026-01-01T00:00:00Z', priceUsd: 'nope' });
    expect(parseMeta(raw).priceUsd).toBeUndefined();
  });
});

describe('serializeMeta', () => {
  it('round-trips through parseMeta', () => {
    const meta: DeckMeta = {
      v: 1,
      updatedAt: '2026-07-19T00:00:00.000Z',
      description: 'hi',
      priceUsd: 5,
    };
    expect(parseMeta(serializeMeta(meta))).toEqual(meta);
  });

  it('writes only the description when there is no machine data, as desktop would', () => {
    expect(serializeMeta({ ...defaultMeta(), description: 'Sideboard plan:\n+2 Smash' })).toBe('Sideboard plan:\n+2 Smash');
    expect(serializeMeta(defaultMeta())).toBe('');
  });

  it('keeps the description as written and puts machine data on a final line', () => {
    const meta: DeckMeta = {
      v: 1, updatedAt: '2026-07-19T00:00:00.000Z', description: 'Notes from FNM.', commanders: ['Atraxa'], bracketLevel: 3,
    };
    const out = serializeMeta(meta);
    expect(out.startsWith('Notes from FNM.\n\n[webatrice] {')).toBe(true);
    expect(out.split('\n')).toHaveLength(3);
    expect(parseMeta(out)).toEqual(meta);
  });
});

describe('parseMeta with desktop comments', () => {
  it('keeps desktop comments exactly as written', () => {
    const text = '  Plan vs control:\n  +2 Smash\n';
    expect(parseMeta(text).description).toBe(text);
  });

  it('reads the machine line without folding it into the description', () => {
    const m = parseMeta('Line one\n\n[webatrice] {"v":1,"updatedAt":"2026-01-01T00:00:00Z","priceUsd":3}');
    expect(m).toEqual({ v: 1, updatedAt: '2026-01-01T00:00:00Z', priceUsd: 3, description: 'Line one' });
  });

  it('treats a machine line that is not the last line as part of the notes', () => {
    const text = '[webatrice] {"v":1}\nmore notes';
    expect(parseMeta(text).description).toBe(text);
  });

  it('still reads decks saved with the whole comments as JSON, and moves the description out on save', () => {
    const legacy = JSON.stringify({ v: 1, updatedAt: '2026-01-01T00:00:00Z', description: 'old notes', commanders: ['Zur'] }, null, 2);
    const m = parseMeta(legacy);
    expect(m.description).toBe('old notes');
    expect(m.commanders).toEqual(['Zur']);
    expect(serializeMeta(m).split('\n')[0]).toBe('old notes');
  });
});

describe('touchMeta', () => {
  it('returns a copy with a newer updatedAt', () => {
    const before: DeckMeta = { v: 1, updatedAt: '2020-01-01T00:00:00.000Z', description: 'x' };
    const after = touchMeta(before);
    expect(after).not.toBe(before);
    expect(after.description).toBe('x');
    expect(new Date(after.updatedAt).getTime()).toBeGreaterThan(new Date(before.updatedAt).getTime());
  });
});
