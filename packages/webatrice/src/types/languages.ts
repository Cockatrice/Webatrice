export enum Language {
  'en_US' = 'en_US',
  'de' = 'de',
  'es' = 'es',
  'fi' = 'fi',
  'fr' = 'fr',
  'it' = 'it',
  'nl' = 'nl',
  'pl' = 'pl',
  'pt_BR' = 'pt_BR',
  'ru' = 'ru',
  'tok' = 'tok',
  'yue' = 'yue',
}

export const DEFAULT_LANGUAGE = Language.en_US;

export const LanguageCountry: Readonly<Record<Language, string | undefined>> = {
  [Language.en_US]: 'us',
  [Language.de]: 'de',
  [Language.es]: 'es',
  [Language.fi]: 'fi',
  [Language.fr]: 'fr',
  [Language.it]: 'it',
  [Language.nl]: 'nl',
  [Language.pl]: 'pl',
  [Language.pt_BR]: 'br',
  [Language.ru]: 'ru',
  [Language.tok]: undefined,
  [Language.yue]: 'hk',
};

export const LanguageNative: Readonly<Record<Language, string>> = {
  [Language.en_US]: 'English - US',
  [Language.de]: 'Deutsch',
  [Language.es]: 'Español',
  [Language.fi]: 'Suomi',
  [Language.fr]: 'Français',
  [Language.it]: 'Italiano',
  [Language.nl]: 'Nederlands',
  [Language.pl]: 'Polski',
  [Language.pt_BR]: 'Português do Brasil',
  [Language.ru]: 'Русский',
  [Language.tok]: 'toki pona',
  [Language.yue]: '粵語',
};
