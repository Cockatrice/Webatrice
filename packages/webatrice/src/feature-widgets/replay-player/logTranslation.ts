import type { TFunction } from 'i18next';
import type { LogSegment } from '@cockatrice/datatrice';

export interface FormattedLog { text: string; segments: LogSegment[] }
export const plain = (text: string): LogSegment => ({ text, kind: 'plain' });
export const p = (text: string): LogSegment => ({ text, kind: 'player' });
export const n = (value: number | string): LogSegment => ({ text: String(value), kind: 'number' });

export function translatedLog(t: TFunction, key: string, values: Record<string, string | LogSegment> = {}): FormattedLog {
  const tokens = Object.values(values).map(value => typeof value === 'string' ? plain(value) : value);
  const placeholders = Object.fromEntries(Object.keys(values).map((name, index) => [name, `\uE000${index}\uE001`]));
  const translated = t(key, placeholders);
  const segments: LogSegment[] = [];
  const append = (segment: LogSegment) => {
    if (!segment.text) {
      return;
    }
    const last = segments[segments.length - 1];
    if (last?.kind === 'plain' && segment.kind === 'plain') {
      last.text += segment.text;
    } else {
      segments.push({ ...segment });
    }
  };
  let offset = 0;
  for (const match of translated.matchAll(/\uE000(\d+)\uE001/g)) {
    append(plain(translated.slice(offset, match.index)));
    append(tokens[Number(match[1])] ?? plain(match[0]));
    offset = match.index! + match[0].length;
  }
  append(plain(translated.slice(offset)));
  return { text: segments.map(segment => segment.text).join(''), segments };
}
