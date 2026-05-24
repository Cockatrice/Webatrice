import type { CardInSet, CardProperties, RelatedCard, XmlNode } from './xml';

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
