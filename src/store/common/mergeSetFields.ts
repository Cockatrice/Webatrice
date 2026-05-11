import { isFieldSet } from '@bufbuild/protobuf';
import type { DescMessage, MessageShape } from '@bufbuild/protobuf';

export function mergeSetFields<Desc extends DescMessage>(
  schema: Desc,
  target: MessageShape<Desc>,
  source: MessageShape<Desc>,
): void {
  for (const field of schema.fields) {
    if (isFieldSet(source, field)) {
      const key = field.localName as keyof MessageShape<Desc>;
      target[key] = source[key];
    }
  }
}
