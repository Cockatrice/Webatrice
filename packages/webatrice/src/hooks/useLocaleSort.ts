import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { toBcp47 } from '@app/utils';

export function useLocaleSort(arr: readonly string[], valueGetter: (value: string) => string): string[] {
  const { i18n } = useTranslation();

  return useMemo(() => {
    const collator = new Intl.Collator(toBcp47(i18n.language));
    return [...arr].sort((a, b) => collator.compare(valueGetter(a), valueGetter(b)));
  }, [arr, i18n.language, valueGetter]);
}
