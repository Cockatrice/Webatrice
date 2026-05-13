// @critical Mirrors carddatabase_v4/cards.xsd; every leaf is `{ value, ...attrs }`. Dexie indexes depend on this shape.
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
