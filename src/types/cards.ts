/**
 * Types here mirror the Cockatrice XML4 schema (`carddatabase_v4/cards.xsd`).
 * Webatrice consumes Oracle's XML output directly, so every leaf preserves the
 * `<element attr="...">value</element>` shape produced by the XML parser:
 * `{ value: <text>, ...attributes }`. The wrapper isn't a DB artifact — it's
 * the bridge between XML and IndexedDB and avoids re-shaping ~30k records.
 */

export interface XmlNode<V = string> {
  value: V;
  [attribute: string]: unknown;
}

export interface CardInSet extends XmlNode<string> {
  picurl?: string;
  picURL?: string;
  num?: string;
  rarity?: string;
  uuid?: string;
  muid?: string;
  isOnlineOnly?: string;
  isRebalanced?: string;
  flavorName?: string;
}

export interface RelatedCard extends XmlNode<string> {
  attach?: string;
  count?: string;
  exclude?: string;
  persistent?: string;
}

export interface CardProperties {
  value: Record<string, XmlNode<string>>;
}

export class Card {
  name: XmlNode<string>;
  text?: XmlNode<string>;
  prop?: CardProperties;
  set: CardInSet | CardInSet[];
  related?: RelatedCard[];
  'reverse-related'?: RelatedCard[];
  token?: XmlNode<string>;
  tablerow?: XmlNode<string>;
  cipt?: XmlNode<string>;
  upsidedown?: XmlNode<string>;
  landscapeOrientation?: XmlNode<string>;
}

export class Set {
  name: XmlNode<string>;
  longname?: XmlNode<string>;
  settype?: XmlNode<string>;
  releasedate?: XmlNode<string>;
  priority?: XmlNode<string>;
}

export class Token {
  name: XmlNode<string>;
  text?: XmlNode<string>;
  prop?: CardProperties;
  set?: CardInSet | CardInSet[];
  related?: RelatedCard[];
  'reverse-related'?: RelatedCard[];
  tablerow?: XmlNode<string>;
}

export interface AllowedCount {
  max: string;
  label: string;
}

export class Format {
  formatName: string;
  minDeckSize?: number;
  maxDeckSize?: number;
  maxSideboardSize?: number;
  allowedCounts?: AllowedCount[];
}

export type ImportSource = 'oracle-local-fs';

export class Info {
  id: 'singleton';
  source: ImportSource;
  sourceUrl?: string;
  sourceVersion?: string;
  author?: string;
  createdAt?: string;
  importedAt: string;
}
