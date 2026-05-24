import { create } from '@bufbuild/protobuf';
import { ServerInfo_UserSchema } from '@cockatrice/sockatrice/generated';
import { isSerializable } from './isSerializable';

describe('isSerializable', () => {
  it('accepts plain objects', () => {
    expect(isSerializable({ a: 1 })).toBe(true);
  });

  it('accepts plain arrays', () => {
    expect(isSerializable([1, 2, 3])).toBe(true);
  });

  it('accepts protobuf-es messages', () => {
    const message = create(ServerInfo_UserSchema, { name: 'Alice' });
    expect(isSerializable(message)).toBe(true);
  });

  it('accepts Uint8Array (bytes fields)', () => {
    expect(isSerializable(new Uint8Array([1, 2, 3]))).toBe(true);
  });

  it('accepts bigint (int64/uint64 fields)', () => {
    expect(isSerializable(10n)).toBe(true);
  });

  it('rejects class instances that are none of the accepted shapes', () => {
    class Custom {
      value = 1;
    }
    expect(isSerializable(new Custom())).toBe(false);
  });

  it('rejects functions', () => {
    expect(isSerializable(() => undefined)).toBe(false);
  });
});
