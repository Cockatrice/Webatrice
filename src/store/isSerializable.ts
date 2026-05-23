import { isPlain } from '@reduxjs/toolkit';
import { isMessage } from '@bufbuild/protobuf';

// Protobuf-es v2 messages are plain objects with $typeName/$unknown siblings;
// bytes fields are Uint8Array and int64/uint64 are BigInt. All four pass
// through this check, which is wired into Datatrice's middleware options so
// the RTK serializable-check middleware tolerates wire payloads.
export function isSerializable(value: unknown): boolean {
  return isPlain(value)
    || isMessage(value)
    || value instanceof Uint8Array
    || typeof value === 'bigint';
}
