import { create } from '@bufbuild/protobuf';
import { useLocation } from 'react-router-dom';
import { vi } from 'vitest';

import {
  Command_DeckDownload_ext,
  Command_DeckList_ext,
  Response_DeckDownloadSchema,
  Response_DeckDownload_ext,
  Response_DeckListSchema,
  Response_DeckList_ext,
  ServerInfo_DeckStorage_FileSchema,
  ServerInfo_DeckStorage_FolderSchema,
  ServerInfo_DeckStorage_TreeItemSchema,
  type ServerInfo_DeckStorage_TreeItem,
} from '@cockatrice/sockatrice/generated';

import { findAllSessionCommands, findLastSessionCommand } from '../helpers/command-capture';
import { buildResponse, buildResponseMessage, deliverMessage } from '../helpers/protobuf-builders';

export interface FakeScryfallCard {
  id: string;
  name: string;
  type_line: string;
  mana_cost?: string;
  cmc: number;
  colors: string[];
  set: string;
  collector_number: string;
  oracle_text?: string;
  usd?: string;
  legalities?: Record<string, string>;
}

const ALL_LEGAL = { commander: 'legal', modern: 'legal', legacy: 'legal', vintage: 'legal' };

export const CARDS: Record<string, FakeScryfallCard[]> = {
  'Sol Ring': [{
    id: 'id-sol-ring', name: 'Sol Ring', type_line: 'Artifact', mana_cost: '{1}', cmc: 1,
    colors: [], set: 'c21', collector_number: '263', oracle_text: '{T}: Add {C}{C}.', usd: '1.50',
    legalities: { commander: 'legal', modern: 'not_legal', legacy: 'banned', vintage: 'restricted' },
  }],
  'Lightning Bolt': [
    {
      id: 'id-bolt-m11', name: 'Lightning Bolt', type_line: 'Instant', mana_cost: '{R}', cmc: 1,
      colors: ['R'], set: 'm11', collector_number: '149', oracle_text: 'Lightning Bolt deals 3 damage to any target.',
      usd: '2.00', legalities: ALL_LEGAL,
    },
    {
      id: 'id-bolt-lea', name: 'Lightning Bolt', type_line: 'Instant', mana_cost: '{R}', cmc: 1,
      colors: ['R'], set: 'lea', collector_number: '161', oracle_text: 'Lightning Bolt deals 3 damage to any target.',
      usd: '400.00',
    },
  ],
  'Llanowar Elves': [{
    id: 'id-elves', name: 'Llanowar Elves', type_line: 'Creature — Elf Druid', mana_cost: '{G}', cmc: 1,
    colors: ['G'], set: 'm19', collector_number: '314', oracle_text: '{T}: Add {G}.', usd: '0.25',
    legalities: ALL_LEGAL,
  }],
  'Forest': [{
    id: 'id-forest', name: 'Forest', type_line: 'Basic Land — Forest', cmc: 0,
    colors: [], set: 'unf', collector_number: '239', oracle_text: '({T}: Add {G}.)', usd: '0.10',
    legalities: ALL_LEGAL,
  }],
  'Atraxa, Grand Unifier': [{
    id: 'id-atraxa', name: 'Atraxa, Grand Unifier', type_line: 'Legendary Creature — Phyrexian Angel',
    mana_cost: '{3}{G}{W}{U}{B}', cmc: 7, colors: ['W', 'U', 'B', 'G'], set: 'one', collector_number: '196',
    oracle_text: 'Flying, vigilance, deathtouch, lifelink', usd: '20.00',
  }],
};

function newestPrinting(name: string): FakeScryfallCard | undefined {
  const printings = CARDS[name];
  return printings?.[0];
}

function findByName(name: string): FakeScryfallCard | undefined {
  const key = Object.keys(CARDS).find((n) => n.toLowerCase() === name.toLowerCase());
  return key ? newestPrinting(key) : undefined;
}

function toScryfallJson(c: FakeScryfallCard) {
  return {
    id: c.id,
    name: c.name,
    type_line: c.type_line,
    mana_cost: c.mana_cost,
    cmc: c.cmc,
    colors: c.colors,
    color_identity: c.colors,
    set: c.set,
    collector_number: c.collector_number,
    oracle_text: c.oracle_text,
    legalities: c.legalities,
    image_uris: {
      small: `https://cards.scryfall.io/small/front/${c.id}.jpg`,
      normal: `https://cards.scryfall.io/normal/front/${c.id}.jpg`,
    },
    prices: { usd: c.usd ?? null },
    purchase_uris: { tcgplayer: `https://tcgplayer.example/${c.id}` },
  };
}

function json(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

export type FetchOverride = (url: string, init?: RequestInit) => Response | Promise<Response> | undefined;

export function stubThirdPartyFetch(override?: FetchOverride) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const overridden = override?.(url, init);
    if (overridden) {
      return overridden;
    }
    if (url === 'https://api.scryfall.com/cards/collection') {
      const { identifiers } = JSON.parse(String(init?.body)) as {
        identifiers: Array<{ name?: string; id?: string; set?: string; collector_number?: string }>;
      };
      const data: unknown[] = [];
      const notFound: unknown[] = [];
      for (const ident of identifiers) {
        const all = Object.values(CARDS).flat();
        const hit = ident.id
          ? all.find((c) => c.id === ident.id)
          : ident.set
            ? all.find((c) => c.set === ident.set && c.collector_number === ident.collector_number)
            : findByName(ident.name ?? '');
        if (hit) {
          data.push(toScryfallJson(hit));
        } else {
          notFound.push(ident);
        }
      }
      return json({ data, not_found: notFound });
    }
    if (url.startsWith('https://api.scryfall.com/cards/named?exact=')) {
      const name = decodeURIComponent(url.slice('https://api.scryfall.com/cards/named?exact='.length));
      const hit = findByName(name);
      return hit ? json(toScryfallJson(hit)) : json({ object: 'error' }, 404);
    }
    if (url.startsWith('https://api.scryfall.com/cards/autocomplete?q=')) {
      const q = decodeURIComponent(url.slice('https://api.scryfall.com/cards/autocomplete?q='.length)).toLowerCase();
      return json({ data: Object.keys(CARDS).filter((n) => n.toLowerCase().includes(q)) });
    }
    if (url.startsWith('https://api.scryfall.com/cards/search?')) {
      const q = new URL(url).searchParams.get('q') ?? '';
      if (q.includes('is:gamechanger')) {
        return json({ data: [{ name: 'Rhystic Study' }] });
      }
      const exact = /^!"(.*)"$/.exec(q);
      if (exact) {
        const printings = CARDS[exact[1]] ?? [];
        return printings.length > 0 ? json({ data: printings.map(toScryfallJson) }) : json({}, 404);
      }
      const text = q.split(' ')[0].toLowerCase();
      const data = Object.keys(CARDS)
        .filter((n) => n.toLowerCase().includes(text))
        .map((n) => toScryfallJson(newestPrinting(n)!));
      return data.length > 0 ? json({ data }) : json({}, 404);
    }
    if (url.startsWith('https://api.scryfall.com/cards/')) {
      const id = decodeURIComponent(url.slice('https://api.scryfall.com/cards/'.length).split('?')[0]);
      const hit = Object.values(CARDS).flat().find((c) => c.id === id);
      return hit ? json(toScryfallJson(hit)) : json({}, 404);
    }
    if (url === 'https://backend.commanderspellbook.com/find-my-combos/') {
      return json({ results: { included: [] } });
    }
    return json({}, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function stubImagePreload(): void {
  class LoadingImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      setTimeout(() => this.onload?.(), 0);
    }
  }
  vi.stubGlobal('Image', LoadingImage);
}

export function fetchCalls(fetchMock: ReturnType<typeof stubThirdPartyFetch>, prefix: string) {
  return fetchMock.mock.calls.filter(([input]) => String(input).startsWith(prefix));
}

export function deckFile(id: number, name: string, creationTime = 1_700_000_000): ServerInfo_DeckStorage_TreeItem {
  return create(ServerInfo_DeckStorage_TreeItemSchema, {
    id,
    name,
    file: create(ServerInfo_DeckStorage_FileSchema, { creationTime }),
  });
}

export function deckFolder(name: string, items: ServerInfo_DeckStorage_TreeItem[]): ServerInfo_DeckStorage_TreeItem {
  return create(ServerInfo_DeckStorage_TreeItemSchema, {
    name,
    folder: create(ServerInfo_DeckStorage_FolderSchema, { items }),
  });
}

export function respondToDeckList(items: ServerInfo_DeckStorage_TreeItem[]): void {
  const { cmdId } = findLastSessionCommand(Command_DeckList_ext);
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId,
    ext: Response_DeckList_ext,
    value: create(Response_DeckListSchema, {
      root: create(ServerInfo_DeckStorage_FolderSchema, { items }),
    }),
  })));
}

export function respondToDeckDownload(deckId: number, xml: string): void {
  const matches = findAllSessionCommands(Command_DeckDownload_ext).filter((c) => c.value.deckId === deckId);
  if (matches.length === 0) {
    throw new Error(`No Command_DeckDownload was sent for deck ${deckId}.`);
  }
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId: matches[matches.length - 1].cmdId,
    ext: Response_DeckDownload_ext,
    value: create(Response_DeckDownloadSchema, { deck: xml }),
  })));
}

export function sentDeckDownloadIds(): number[] {
  return findAllSessionCommands(Command_DeckDownload_ext).map((c) => c.value.deckId);
}

export interface CodCard {
  name: string;
  quantity?: number;
  commander?: boolean;
  set?: string;
  num?: string;
}

export function codXml(opts: {
  name: string;
  format?: string;
  comments?: Record<string, unknown>;
  main?: CodCard[];
  side?: CodCard[];
  bracketLevel?: number;
  extraXml?: string;
}): string {
  const card = (c: CodCard) =>
    `<card number="${c.quantity ?? 1}" name="${c.name}"${c.set ? ` set="${c.set}"` : ''}`
    + `${c.num ? ` num="${c.num}"` : ''}${c.commander ? ' commander="1"' : ''}/>`;
  const comments = JSON.stringify({ v: 1, updatedAt: '2026-01-01T00:00:00.000Z', ...opts.comments });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<cockatrice_deck version="1">',
    `<deckname>${opts.name}</deckname>`,
    `<comments>${comments}</comments>`,
    opts.format !== undefined ? `<format>${opts.format}</format>` : '',
    opts.bracketLevel != null
      ? `<bracketAssessment level="${opts.bracketLevel}" fingerprint="00000000"/>`
      : '',
    opts.extraXml ?? '',
    `<zone name="main">${(opts.main ?? []).map(card).join('')}</zone>`,
    `<zone name="side">${(opts.side ?? []).map(card).join('')}</zone>`,
    '</cockatrice_deck>',
  ].join('');
}

export function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}
