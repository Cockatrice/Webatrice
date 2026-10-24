import type { Card, Set, Token, XmlNode } from '../dexie/types';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function writeNode(tag: string, node: XmlNode<unknown>, indent: string): string {
  const attrs = Object.entries(node)
    .filter(([key, value]) => key !== 'value' && typeof value === 'string')
    .map(([key, value]) => ` ${key}="${escapeXml(value as string)}"`)
    .join('');
  const { value } = node;
  if (value !== null && typeof value === 'object') {
    const children = writeChildren(value as Record<string, unknown>, `${indent}  `);
    return `${indent}<${tag}${attrs}>\n${children}${indent}</${tag}>\n`;
  }
  return `${indent}<${tag}${attrs}>${escapeXml(String(value ?? ''))}</${tag}>\n`;
}

function writeChildren(record: Record<string, unknown>, indent: string): string {
  return Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .flatMap(([tag, value]) => (Array.isArray(value) ? value : [value]).map((node) => writeNode(tag, node as XmlNode<unknown>, indent)))
    .join('');
}

export function writeCockatriceXml({ sets = [], cards = [] }: { sets?: Set[]; cards?: Array<Card | Token> }): string {
  const setXml = sets.map((set) => writeNode('set', { value: set as unknown as Record<string, unknown> }, '    ')).join('');
  const cardXml = cards.map((card) => writeNode('card', { value: card as unknown as Record<string, unknown> }, '    ')).join('');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    '<cockatrice_carddatabase version="4">\n',
    `  <sets>\n${setXml}  </sets>\n`,
    `  <cards>\n${cardXml}  </cards>\n`,
    '</cockatrice_carddatabase>\n',
  ].join('');
}
