import type { CardInSet, CardProperties, RelatedCard, XmlNode } from './xml';

export class Token {
  name: XmlNode<string>;
  text?: XmlNode<string>;
  prop?: CardProperties;
  set?: CardInSet | CardInSet[];
  related?: RelatedCard[];
  'reverse-related'?: RelatedCard[];
  tablerow?: XmlNode<string>;
}
