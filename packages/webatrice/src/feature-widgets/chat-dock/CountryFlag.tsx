import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Images } from '@app/images';

export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale.replaceAll('_', '-'), 'en'], { type: 'region' }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function CountryFlag({ cc }: { cc: string | undefined }) {
  const { i18n } = useTranslation();
  const name = useMemo(() => (cc ? countryName(cc, i18n.language) : ''), [cc, i18n.language]);
  if (!cc || !Images.Countries[cc]) {
    return null;
  }
  return <img src={Images.Countries[cc]} alt={name} title={name} className="h-3 w-auto shrink-0 rounded-[2px]" />;
}
