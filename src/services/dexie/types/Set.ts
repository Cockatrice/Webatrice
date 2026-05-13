import type { XmlNode } from './xml';

export class Set {
  name: XmlNode<string>;
  longname?: XmlNode<string>;
  settype?: XmlNode<string>;
  releasedate?: XmlNode<string>;
  priority?: XmlNode<string>;
}
