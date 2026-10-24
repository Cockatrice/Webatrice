import { readDeckPlaymat } from '@app/services';

import { readDeckTags } from './deckTags';
import type { HydratedDeck } from './types';

export interface DeckShareLink {
  token: string;
  hostname: string;
  port: string;
}

export type DeckShareLinkProblem = 'invalid' | 'hostname' | 'port' | 'share';

const SHARE_PARAM = 'share';
const HOSTNAME_PARAM = 'hostname';
const PORT_PARAM = 'port';

export function buildDeckShareLink(base: string, link: DeckShareLink): string {
  const url = new URL(base);
  url.search = '';
  url.hash = deckShareQuery(link);
  return url.toString();
}

export function deckShareQuery(link: DeckShareLink): string {
  const params = new URLSearchParams();
  params.set(SHARE_PARAM, link.token);
  params.set(HOSTNAME_PARAM, link.hostname);
  params.set(PORT_PARAM, link.port);
  return params.toString();
}

export function parseDeckShareQuery(params: URLSearchParams): DeckShareLink | { problem: DeckShareLinkProblem } {
  const hostname = params.get(HOSTNAME_PARAM)?.trim() ?? '';
  const port = params.get(PORT_PARAM)?.trim() ?? '';
  const token = params.get(SHARE_PARAM)?.trim() ?? '';
  if (!hostname) {
    return { problem: 'hostname' };
  }
  const portNumber = Number(port);
  if (!/^\d+$/.test(port) || portNumber <= 0 || portNumber > 65535) {
    return { problem: 'port' };
  }
  if (!token) {
    return { problem: 'share' };
  }
  return { token, hostname, port };
}

function fragmentParams(hash: string): URLSearchParams | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.has(SHARE_PARAM) ? params : null;
}

export function parseDeckShareLink(text: string): DeckShareLink | { problem: DeckShareLinkProblem } {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return { problem: 'invalid' };
  }
  const desktop = url.protocol === 'cockatrice:' && url.hostname === 'opendeck';
  if (!desktop && url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { problem: 'invalid' };
  }
  return parseDeckShareQuery(fragmentParams(url.hash) ?? url.searchParams);
}

export function shareServerFromEndpoint(endpoint: string | null | undefined): Omit<DeckShareLink, 'token'> | null {
  if (!endpoint) {
    return null;
  }
  try {
    const url = new URL(endpoint);
    if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash) {
      return null;
    }
    return { hostname: url.href, port: url.port || (url.protocol === 'wss:' ? '443' : '80') };
  } catch {
    return null;
  }
}

export function isSameShareServer(
  link: DeckShareLink,
  endpoint: string | undefined,
  desktopPort?: string,
): boolean {
  const live = shareServerFromEndpoint(endpoint);
  if (!live) {
    return false;
  }
  const direct = shareServerFromEndpoint(link.hostname);
  if (direct) {
    return direct.hostname === live.hostname && direct.port === link.port;
  }
  return !!desktopPort && /^\d+$/.test(desktopPort)
    && Number(desktopPort) >= 1 && Number(desktopPort) <= 65535
    && new URL(live.hostname).hostname === link.hostname.toLowerCase()
    && Number(desktopPort) === Number(link.port);
}

export function formatShareExpiry(unixSeconds: bigint | number, locale?: string): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

export function isBlankDeck(
  deck: Pick<HydratedDeck, 'name' | 'meta' | 'cards' | 'bannerCard' | 'bannerCardProviderId' | 'playmatXml' | 'tagsXml'>,
): boolean {
  const hasPlaymatCard = readDeckPlaymat(deck.playmatXml) != null;
  return deck.cards.length === 0
    && !deck.name
    && !deck.meta.description
    && !deck.bannerCard
    && !deck.bannerCardProviderId
    && !hasPlaymatCard
    && readDeckTags(deck.tagsXml).length === 0;
}

let pendingLink: string | null = null;

export function captureDeckShareLink(win: Window = window): boolean {
  const params = fragmentParams(win.location.hash);
  if (!params) {
    return false;
  }
  const link = new URLSearchParams();
  for (const name of [SHARE_PARAM, HOSTNAME_PARAM, PORT_PARAM]) {
    const value = params.get(name);
    if (value !== null) {
      link.set(name, value);
    }
    params.delete(name);
  }
  const rest = params.toString();
  try {
    win.history.replaceState(win.history.state, '', `${win.location.pathname}${win.location.search}${rest ? `#${rest}` : ''}`);
  } catch {
    /* the address bar keeps the fragment; nothing else reads it */
  }
  pendingLink = link.toString();
  return true;
}

export function takePendingDeckShareLink(): string | null {
  const query = pendingLink;
  pendingLink = null;
  return query;
}
