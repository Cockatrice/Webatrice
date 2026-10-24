import { useTranslation } from 'react-i18next';

import { Images } from '@app/images';

export function countryName(code: string, locale: string | undefined): string {
  try {
    return new Intl.DisplayNames(locale ? [locale, 'en'] : ['en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function CountryFlag({ country }: { country: string | undefined }) {
  const { i18n } = useTranslation();
  const src = country ? Images.Countries[country] : undefined;
  if (!country || !src) {
    return null;
  }
  return (
    <img
      src={src}
      alt={countryName(country, i18n.language)}
      title={countryName(country, i18n.language)}
      className="h-3 w-4 shrink-0 rounded-[2px] object-cover"
    />
  );
}
