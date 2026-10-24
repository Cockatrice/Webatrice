const rowKeys = new WeakMap<object, number>();
let nextRowKey = 0;

export function logRowKey(message: object): number {
  let key = rowKeys.get(message);
  if (key === undefined) {
    key = nextRowKey++;
    rowKeys.set(message, key);
  }
  return key;
}
