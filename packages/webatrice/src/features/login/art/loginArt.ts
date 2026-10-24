import { ScryfallImageSize } from '@cockatrice/datatrice';
import { getScryfallUrlByExactName, readLocalStorage, writeLocalStorage } from '@app/services';

export const LOGIN_ART_STORAGE_KEY = 'webatrice.loginArt';

export interface LoginArtChoice {
  url: string;
  attribution: string;
}

export const LOGIN_ART_CARDS: readonly string[] = [
  'The Ur-Dragon',
  'Shivan Dragon',
  'Serra Angel',
  'Llanowar Elves',
  'Ugin, the Spirit Dragon',
  'Emrakul, the Aeons Torn',
  'Craterhoof Behemoth',
  'Niv-Mizzet, Parun',
  'Lightning Bolt',
  'Elesh Norn, Grand Cenobite',
  'Avacyn, Angel of Hope',
  'Griselbrand',
];

export function loginArtUrl(name: string): string {
  return getScryfallUrlByExactName(name, ScryfallImageSize.ArtCrop);
}

export function createLoginArt(random: () => number = Math.random, current?: string): LoginArtChoice {
  const attribution = pickLoginArt(random, current);
  return { attribution, url: loginArtUrl(attribution) };
}

export function readLoginArt(): LoginArtChoice | undefined {
  const raw = readLocalStorage(LOGIN_ART_STORAGE_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    const value = JSON.parse(raw) as Partial<LoginArtChoice>;
    if (
      typeof value.attribution === 'string'
      && LOGIN_ART_CARDS.includes(value.attribution)
      && value.url === loginArtUrl(value.attribution)
    ) {
      return { attribution: value.attribution, url: value.url };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function writeLoginArt(art: LoginArtChoice): void {
  writeLocalStorage(LOGIN_ART_STORAGE_KEY, JSON.stringify(art));
}

export function clearLoginArt(art: LoginArtChoice): void {
  if (readLoginArt()?.url === art.url) {
    writeLocalStorage(LOGIN_ART_STORAGE_KEY, '');
  }
}

export function pickLoginArt(random: () => number = Math.random, current?: string): string {
  const pool = LOGIN_ART_CARDS.filter((name) => name !== current);
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index];
}
