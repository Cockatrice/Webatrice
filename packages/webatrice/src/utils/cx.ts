export type CxArg =
  | string
  | number
  | false
  | null
  | undefined
  | CxArg[]
  | { [className: string]: unknown };

export function cx(...args: CxArg[]): string {
  const out: string[] = [];
  for (const arg of args) {
    if (!arg) {
      continue;
    }
    if (typeof arg === 'string' || typeof arg === 'number') {
      out.push(String(arg));
    } else if (Array.isArray(arg)) {
      const nested = cx(...arg);
      if (nested) {
        out.push(nested);
      }
    } else if (typeof arg === 'object') {
      for (const key of Object.keys(arg)) {
        if (arg[key]) {
          out.push(key);
        }
      }
    }
  }
  return out.join(' ');
}
