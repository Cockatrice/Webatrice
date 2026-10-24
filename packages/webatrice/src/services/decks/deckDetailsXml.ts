import { validateCod } from './cockatriceDeckDocument';

export function patchDeckDetails(xml: string, details: {
  name?: string;
  banner?: { name: string; providerId?: string } | null;
  tagsXml?: string;
}): string {
  if (!validateCod(xml)) {
    throw new Error('Cockatrice deck XML is malformed');
  }
  let result = xml;
  if (details.name !== undefined) {
    const doc = document.implementation.createDocument(null, 'deckname');
    doc.documentElement.textContent = details.name;
    const deckname = new XMLSerializer().serializeToString(doc.documentElement);
    const after = ['format', 'bannerCard', 'playmatCard', 'comments', 'tags', 'zone', 'sideboard_plan'];
    result = replaceChild(result, 'deckname', deckname, after);
  }
  if (details.banner !== undefined) {
    let banner = '';
    if (details.banner?.name) {
      const doc = document.implementation.createDocument(null, 'bannerCard');
      doc.documentElement.setAttribute('providerId', details.banner.providerId ?? '');
      doc.documentElement.textContent = details.banner.name;
      banner = new XMLSerializer().serializeToString(doc.documentElement);
    }
    result = replaceChild(result, 'bannerCard', banner, ['playmatCard', 'comments', 'tags', 'zone', 'sideboard_plan']);
  }
  if (details.tagsXml !== undefined) {
    const doc = new DOMParser().parseFromString(details.tagsXml, 'application/xml');
    if (doc.querySelector('parsererror') || doc.documentElement.tagName !== 'tags') {
      throw new Error('Deck tags XML is malformed');
    }
    result = replaceChild(result, 'tags', details.tagsXml, ['zone', 'sideboard_plan']);
  }
  return result;
}

function replaceChild(xml: string, name: string, replacement: string, before: string[]): string {
  const spans: { name: string; start: number; end: number }[] = [];
  const tokens = new RegExp([
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/.source,
    /<!DOCTYPE(?:[^>"'[]|"[^"]*"|'[^']*'|\[[\s\S]*?\])*>/.source,
    /<\/?[^\s<>/!?]+(?:[^>"']|"[^"]*"|'[^']*')*>/.source,
  ].join('|'), 'g');
  let depth = 0;
  let child: { name: string; start: number; end: number } | undefined;
  let rootEnd = xml.length;
  let emptyRootEnd: number | undefined;
  for (const match of xml.matchAll(tokens)) {
    const token = match[0];
    if (token.startsWith('<!') || token.startsWith('<?')) {
      continue;
    }
    if (token.startsWith('</')) {
      depth--;
      if (depth === 1 && child) {
        child.end = match.index + token.length;
        spans.push(child);
        child = undefined;
      } else if (depth === 0) {
        rootEnd = match.index;
      }
    } else {
      if (depth === 1) {
        child = { name: /^<([^\s/>]+)/.exec(token)![1], start: match.index, end: match.index + token.length };
      }
      if (token.endsWith('/>')) {
        if (depth === 0) {
          emptyRootEnd = match.index + token.length - 2;
        } else if (depth === 1 && child) {
          spans.push(child);
          child = undefined;
        }
      } else {
        depth++;
      }
    }
  }
  const existing = spans.filter((span) => span.name === name);
  if (existing.length) {
    let result = xml;
    for (let i = existing.length - 1; i >= 0; i--) {
      const span = existing[i];
      result = result.slice(0, span.start) + (i === 0 ? replacement : '') + result.slice(span.end);
    }
    return result;
  }
  if (!replacement) {
    return xml;
  }
  const at = spans.find((span) => before.includes(span.name))?.start ?? rootEnd;
  if (emptyRootEnd !== undefined) {
    return xml.slice(0, emptyRootEnd) + `>${replacement}</cockatrice_deck>` + xml.slice(emptyRootEnd + 2);
  }
  return xml.slice(0, at) + replacement + xml.slice(at);
}
