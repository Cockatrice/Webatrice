export interface MentionQuery {
  start: number;
  prefix: string;
}

export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const start = text.lastIndexOf('@', caret - 1);
  if (start === -1 || (start > 0 && !/\s/.test(text[start - 1]))) {
    return null;
  }
  const prefix = text.slice(start, caret);
  return /\s/.test(prefix) ? null : { start, prefix };
}

export function matchMentions(names: readonly string[], prefix: string, limit: number): string[] {
  const typed = prefix.replace(/^@/, '').toLowerCase();
  const matches: string[] = [];
  for (const name of names) {
    if (name.toLowerCase().startsWith(typed) && !matches.includes(name)) {
      matches.push(name);
      if (matches.length === limit) {
        break;
      }
    }
  }
  return matches;
}

export function applyMention(text: string, query: MentionQuery, caret: number, name: string) {
  const inserted = `@${name} `;
  return {
    text: text.slice(0, query.start) + inserted + text.slice(caret),
    caret: query.start + inserted.length,
  };
}
