import { ScryfallImageSize } from '@cockatrice/datatrice';

import { getScryfallUrlByName } from '../scryfall';
import type { CardInSet, CardProperties, XmlNode } from '../dexie/types';
import { expandPictureUrlTemplate } from './pictureUrlTemplates';
import { sortBySetPreference, type SetPreferenceMap } from './setPriority';

export interface CardImageSubject {
  name?: XmlNode<string>;
  prop?: CardProperties;
  set?: CardInSet | CardInSet[];
}

export interface CardImageOptions {
  templates: readonly string[];
  setPreferences: SetPreferenceMap;
  setLongNames?: ReadonlyMap<string, string>;
  preferredSet?: string;
  pinnedPrintingId?: string;
  lang?: string;
  fallbackSize?: ScryfallImageSize;
}

export function printingsOf(card: CardImageSubject): CardInSet[] {
  if (!card.set) {
    return [];
  }
  return Array.isArray(card.set) ? card.set : [card.set];
}

export function printingProperties(printing: CardInSet): Record<string, string> {
  const props: Record<string, string> = {};
  for (const [key, value] of Object.entries(printing)) {
    if (key !== 'value' && typeof value === 'string') {
      props[key === 'picURL' ? 'picurl' : key] = value;
    }
  }
  return props;
}

export function cardProperties(card: CardImageSubject): Record<string, string> {
  const props: Record<string, string> = {};
  for (const [key, node] of Object.entries(card.prop?.value ?? {})) {
    if (typeof node?.value === 'string') {
      props[key] = node.value;
    }
  }
  return props;
}

export function resolvePrintingImageUrls(
  card: CardImageSubject,
  printing: CardInSet | undefined,
  options: Pick<CardImageOptions, 'templates' | 'setLongNames' | 'lang'>,
): string[] {
  const name = card.name?.value ?? '';
  const urls: string[] = [];
  const printingProps = printing ? printingProperties(printing) : {};

  if (printingProps.picurl) {
    urls.push(printingProps.picurl);
  }

  const props = cardProperties(card);
  const set = printing?.value
    ? { code: printing.value, longName: options.setLongNames?.get(printing.value), printing: printingProps }
    : undefined;

  for (const template of options.templates) {
    const url = expandPictureUrlTemplate(template, { name, props, set, lang: options.lang ?? 'en' });
    if (url) {
      urls.push(url);
    }
  }
  return urls;
}

export function resolveCardImageUrls(card: CardImageSubject, options: CardImageOptions): string[] {
  const sorted = options.pinnedPrintingId && !options.preferredSet
    ? printingsOf(card).filter((printing) => printing.uuid === options.pinnedPrintingId)
    : sortBySetPreference(printingsOf(card), (p) => p.value, options.setPreferences);
  if (options.preferredSet) {
    const index = sorted.findIndex((p) => p.value === options.preferredSet);
    if (index > 0) {
      sorted.unshift(...sorted.splice(index, 1));
    }
  }

  const urls = sorted.length
    ? sorted.flatMap((printing) => resolvePrintingImageUrls(card, printing, options))
    : resolvePrintingImageUrls(card, undefined, options);

  const name = card.name?.value;
  if (name) {
    urls.push(getScryfallUrlByName(name, options.fallbackSize ?? ScryfallImageSize.Normal));
  }
  return [...new Set(urls)];
}
