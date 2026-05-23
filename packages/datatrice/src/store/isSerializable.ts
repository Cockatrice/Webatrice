import { isPlain } from '@reduxjs/toolkit';
import { isMessage } from '@bufbuild/protobuf';

// See .github/instructions/datatrice.instructions.md#initialization-order.
export function isSerializable(value: unknown): boolean {
  return isPlain(value)
    || isMessage(value)
    || value instanceof Uint8Array
    || typeof value === 'bigint';
}
