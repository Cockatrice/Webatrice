import type { TFunction } from 'i18next';
import IntlMessageFormat from 'intl-messageformat';

export function catalogT(...catalogs: object[]): TFunction {
  const merged = Object.assign({}, ...catalogs) as Record<string, unknown>;
  return ((key: string, params: Record<string, unknown> = {}) => {
    const message = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], merged);
    if (typeof message !== 'string') {
      throw new Error(`No English message for ${key}`);
    }
    return String(new IntlMessageFormat(message, 'en').format(params));
  }) as unknown as TFunction;
}
