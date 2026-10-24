import type { CSSProperties } from 'react';

export const ALL_MENTION = '@/all';

export type ChatAlertKind = 'mention' | 'allMention' | 'word';

export interface ChatAlertContext {
  selfName: string | null;
  userNames?: readonly string[];
  mentions: boolean;
  highlightWords: readonly string[];
  senderIsModerator: boolean;
}

export interface ChatHighlight {
  selfName: string | null;
  userNames?: readonly string[];
  mentions: boolean;
  mentionStyle: CSSProperties;
  highlightWords: readonly string[];
  highlightStyle: CSSProperties;
  senderIsModerator: boolean;
}

export function highlightStyle(hexColor: string, whiteText: boolean): CSSProperties {
  return { backgroundColor: `#${hexColor}`, color: whiteText ? 'white' : 'black' };
}

export type TextSegmentKind = 'plain' | 'word' | 'allMention';

export interface TextSegment {
  kind: TextSegmentKind;
  text: string;
}

const TRAILING_PUNCTUATION = /[^\p{L}\p{N}]+$/u;

export function parseHighlightWords(raw: string): string[] {
  return raw.split(/\s+/).filter(Boolean);
}

function splitTrailing(word: string): [core: string, rest: string] {
  const match = word.match(TRAILING_PUNCTUATION);
  return match ? [word.slice(0, match.index), match[0]] : [word, ''];
}

export function tokenizeChat(text: string): { kind: 'plain' | 'word' | 'mention'; text: string }[] {
  const tokens: { kind: 'plain' | 'word' | 'mention'; text: string }[] = [];
  for (const part of text.matchAll(/[^\p{L}\p{N}@]+|[@\p{L}\p{N}][^ ]*/gu)) {
    const value = part[0];
    tokens.push({ kind: value.startsWith('@') ? 'mention' : /^[\p{L}\p{N}]/u.test(value) ? 'word' : 'plain', text: value });
  }
  return tokens;
}

export function isOwnMention(name: string, selfName: string | null): boolean {
  return selfName != null && name.toLowerCase() === selfName.toLowerCase();
}

export interface Mention {
  name: string;
  rest: string;
  own: boolean;
}

export function parseMention(token: string, selfName: string | null, userNames: readonly string[] = []): Mention {
  const directory = new Set(userNames.map((name) => name.toLowerCase()));
  for (let name = token; name; name = name.slice(0, -1)) {
    if (directory.has(name.toLowerCase()) || isOwnMention(name, selfName)) {
      return { name, rest: token.slice(name.length), own: isOwnMention(name, selfName) };
    }
    if (!TRAILING_PUNCTUATION.test(name)) {
      break;
    }
  }
  const [name, rest] = splitTrailing(token);
  return { name, rest, own: false };
}

export function segmentText(
  text: string,
  { highlightWords, allMention }: { highlightWords: readonly string[]; allMention: boolean },
): TextSegment[] {
  const words = new Set(highlightWords.map((w) => w.toLowerCase()));
  if (words.size === 0 && !allMention) {
    return [{ kind: 'plain', text }];
  }

  const segments: TextSegment[] = [];
  const push = (kind: TextSegmentKind, part: string) => {
    if (!part) {
      return;
    }
    const last = segments[segments.length - 1];
    if (kind === 'plain' && last?.kind === 'plain') {
      last.text += part;
    } else {
      segments.push({ kind, text: part });
    }
  };

  for (const { text: token, kind } of tokenizeChat(text)) {
    const [core, rest] = splitTrailing(token);
    if (allMention && core.toLowerCase() === ALL_MENTION) {
      push('allMention', core);
      push('plain', rest);
    } else if (kind === 'word' && core && words.has(core.toLowerCase())) {
      push('word', core);
      push('plain', rest);
    } else {
      push('plain', token);
    }
  }
  return segments;
}

export function findChatAlert(text: string, ctx: ChatAlertContext): ChatAlertKind | null {
  if (ctx.mentions) {
    for (const token of tokenizeChat(text)) {
      if (token.kind === 'mention' && parseMention(token.text.slice(1), ctx.selfName, ctx.userNames).own) {
        return 'mention';
      }
    }
  }
  const segments = segmentText(text, {
    highlightWords: ctx.highlightWords,
    allMention: ctx.mentions && ctx.senderIsModerator,
  });
  if (segments.some((s) => s.kind === 'allMention')) {
    return 'allMention';
  }
  return segments.some((s) => s.kind === 'word') ? 'word' : null;
}
