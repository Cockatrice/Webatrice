import { create } from '@bufbuild/protobuf';
import { ServerInfo_CardCounterSchema, colorSchema } from '@cockatrice/sockatrice/generated';
import type { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { ZoneName } from '@cockatrice/sockatrice';
import type { GameEntry, PlayerEntry } from '@cockatrice/datatrice';
import {
  makeCard,
  makeCounter,
  makeGameEntry,
  makeGameInfo,
  makePlayerEntry,
  makePlayerProperties,
  makeUser,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';

type Row = 0 | 1 | 2;
interface Perm { name: string; row: Row; tapped?: boolean; pt?: string; counters?: number; copies?: number }
interface Attachment { name: string; to: string }
interface SeatSpec {
  id: number;
  user: string;
  commander: string;
  life: number;
  perms: Perm[];
  attachments?: Attachment[];
  hand?: string[];
  handCount: number;
  deck: number;
  grave: string[];
  exile: string[];
}

const creature = (name: string, pt: string, o: Partial<Perm> = {}): Perm => ({ name, row: 0, pt, ...o });
const other = (name: string, o: Partial<Perm> = {}): Perm => ({ name, row: 1, ...o });
const land = (name: string, copies: number, tapped = 0): Perm[] =>
  Array.from({ length: copies }, (_, i) => ({ name, row: 2 as Row, tapped: i < tapped }));

const SEATS: SeatSpec[] = [
  {
    id: 1, user: 'Alex', commander: 'Kenrith, the Returned King', life: 38, handCount: 7, deck: 66,
    perms: [
      ...land('Forest', 4, 2), ...land('Mountain', 3, 1), ...land('Ancient Tomb', 1), ...land('Command Tower', 1, 1),
      ...land('Stomping Ground', 1), ...land('Exotic Orchard', 1),
      other('Sol Ring', { tapped: true }), other('Arcane Signet'), other('Lotus Petal'), other('Lion\'s Eye Diamond'),
      creature('Llanowar Elves', '1/1', { tapped: true }), creature('Birds of Paradise', '0/1'),
      creature('Eternal Witness', '2/1'), creature('Soldier Token', '1/1', { copies: 3 }),
      creature('Treasure Token', '', { copies: 2 }),
    ],
    attachments: [{ name: 'Lightning Greaves', to: 'Eternal Witness' }, { name: 'Rancor', to: 'Birds of Paradise' }],
    hand: ['Cultivate', 'Swords to Plowshares', 'Beast Within', 'Craterhoof Behemoth', 'Heroic Intervention',
      'Teferi\'s Protection', 'Farseek'],
    grave: ['Ponder', 'Brainstorm', 'Rampant Growth', 'Nature\'s Lore', 'Counterspell'],
    exile: ['Snapcaster Mage', 'Mana Drain'],
  },
  {
    id: 2, user: 'Kess', commander: 'Kess, Dissident Mage', life: 40, handCount: 5, deck: 58,
    perms: [
      ...land('Island', 5, 2), ...land('Swamp', 3, 1), ...land('Mountain', 2), ...land('Command Tower', 1),
      ...land('Steam Vents', 1, 1), ...land('Gemstone Caverns', 1),
      other('Mystic Remora', { counters: 2 }), other('Talisman of Dominance', { tapped: true }), other('Underworld Breach'),
      other('Chrome Mox'), other('Fellwar Stone'),
      creature('Snapcaster Mage', '2/1'), creature('Baral, Chief of Compliance', '1/3'),
      creature('Dark Confidant', '2/1', { tapped: true }), creature('Human Soldier Token', '1/1', { copies: 2 }),
    ],
    attachments: [{ name: 'Swiftfoot Boots', to: 'Baral, Chief of Compliance' }],
    grave: ['Lightning Bolt', 'Ponder', 'Preordain', 'Dark Ritual', 'Fact or Fiction', 'Counterspell'],
    exile: ['Force of Will', 'Misdirection', 'Daze'],
  },
  {
    id: 3, user: 'Tomo', commander: 'The Ur-Dragon', life: 12, handCount: 2, deck: 61,
    perms: [
      ...land('Forest', 5, 5), ...land('Mountain', 2, 2), ...land('Cavern of Souls', 1, 1),
      ...land('Haven of the Spirit Dragon', 1), ...land('Path of Ancestry', 1, 1),
      other('Dragon\'s Hoard', { tapped: true }), other('Herald\'s Horn'), other('Gaea\'s Cradle'),
      creature('Scion of the Ur-Dragon', '4/4'), creature('Old Gnawbone', '7/7', { tapped: true }),
      creature('Dragon Token', '5/5', { copies: 3 }), creature('Kithkin Token', '1/1'),
    ],
    attachments: [{ name: 'Sword of Feast and Famine', to: 'Scion of the Ur-Dragon' }],
    grave: ['Cultivate', 'Kodama\'s Reach', 'Crux of Fate'],
    exile: [],
  },
  {
    id: 4, user: 'Ravi', commander: 'Atraxa, Praetors\' Voice', life: 34, handCount: 4, deck: 55,
    perms: [
      ...land('Forest', 6, 4), ...land('Island', 3, 3), ...land('Swamp', 4, 2), ...land('Plains', 1),
      ...land('Command Tower', 1, 1), ...land('Breeding Pool', 1, 1), { name: 'Dark Depths', row: 2, counters: 9 },
      other('Doubling Season'), other('Contagion Engine'), other('Vraska, Golgari Queen', { counters: 6 }),
      creature('Atraxa, Praetors\' Voice', '4/4', { tapped: true }), creature('Evolution Sage', '3/2'),
      creature('Fathom Mage', '1/1', { counters: 3 }), creature('Sowing Mycospawn', '3/3'),
      creature('Livio, Oathsworn Sentinel', '2/4'), creature('Orcish Lumberjack', '1/1'),
    ],
    attachments: [{ name: 'Utopia Sprawl', to: 'Forest' }, { name: 'Darksteel Plate', to: 'Evolution Sage' }],
    grave: ['Swords to Plowshares', 'Farseek', 'Inexorable Tide', 'Grim Flayer', 'Thrummingbird', 'Toxic Deluge'],
    exile: ['Path to Exile', 'Swords to Plowshares', 'Sol Ring'],
  },
  {
    id: 5, user: 'Ines', commander: 'Edgar Markov', life: 29, handCount: 3, deck: 60,
    perms: [
      ...land('Plains', 3, 1), ...land('Swamp', 3, 2), ...land('Mountain', 2), ...land('Command Tower', 1),
      other('Sorin, Imperious Bloodlord', { counters: 4 }), other('Smothering Tithe'),
      creature('Vampire Token', '1/1', { copies: 5 }), creature('Bloodghast', '2/1'),
    ],
    attachments: [{ name: 'Bonesplitter', to: 'Bloodghast' }],
    grave: ['Vampiric Tutor', 'Cordial Vampire', 'Kindred Dominance'],
    exile: ['Sol Ring'],
  },
  {
    id: 6, user: 'Odo', commander: 'Yuriko, the Tiger\'s Shadow', life: 33, handCount: 6, deck: 57,
    perms: [
      ...land('Island', 4, 2), ...land('Swamp', 3), ...land('Watery Grave', 1), ...land('Polluted Delta', 1),
      other('Talisman of Dominance'), other('Rhystic Study'),
      creature('Ingenious Infiltrator', '2/3'), creature('Ninja of the Deep Hours', '2/2', { tapped: true }),
      creature('Faerie Rogue Token', '1/1', { copies: 2 }),
    ],
    grave: ['Brainstorm', 'Ponder', 'Fatal Push', 'Snuff Out'],
    exile: [],
  },
];

let nextCardId = 1000;

function placeTable(perms: Perm[]): ServerInfo_Card[] {
  const out: ServerInfo_Card[] = [];
  for (const row of [0, 1, 2] as Row[]) {
    const piles: { name: string; col: number; depth: number }[] = [];
    let nextCol = 0;
    for (const p of perms.filter((q) => q.row === row)) {
      for (let k = 0; k < (p.copies ?? 1); k++) {
        let pile = piles.find((x) => x.name === p.name && x.depth < 3 && !p.counters);
        if (!pile) {
          pile = { name: p.name, col: nextCol++, depth: 0 };
          piles.push(pile);
        }
        out.push(makeCard({
          id: nextCardId++,
          name: p.name,
          x: pile.col * 3 + pile.depth,
          y: row,
          tapped: !!p.tapped,
          pt: p.pt ?? '',
          counterList: p.counters ? [create(ServerInfo_CardCounterSchema, { id: 2, value: p.counters })] : [],
        }));
        pile.depth++;
      }
    }
  }
  return out;
}

function attach(table: ServerInfo_Card[], playerId: number, attachments: Attachment[]): ServerInfo_Card[] {
  const out = [...table];
  for (const a of attachments) {
    const target = out.find((c) => c.name === a.to);
    if (target) {
      out.push(makeCard({
        id: nextCardId++,
        name: a.name,
        x: -1,
        y: -1,
        attachPlayerId: playerId,
        attachZone: ZoneName.TABLE,
        attachCardId: target.id,
      }));
    }
  }
  return out;
}

const listCards = (names: string[]) => names.map((name) => makeCard({ id: nextCardId++, name }));

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const deckListFor = (commander: string) =>
  '<cockatrice_deck version="1"><deckname>Layout check</deckname>'
  + `<zone name="commander"><card number="1" name="${escapeXml(commander)}"/></zone>`
  + '<zone name="main"><card number="99" name="Forest"/></zone></cockatrice_deck>';

const COUNTER_NAMES = ['life', 'w', 'u', 'b', 'r', 'g', 'x', 'storm'];

function buildPlayer(s: SeatSpec, localId: number): PlayerEntry {
  const counters: PlayerEntry['counters'] = {};
  COUNTER_NAMES.forEach((name, i) => {
    counters[i] = makeCounter({
      id: i,
      name,
      count: i === 0 ? s.life : 0,
      counterColor: create(colorSchema, { r: 200, g: 200, b: 200, a: 255 }),
    });
  });
  const table = attach(placeTable(s.perms), s.id, s.attachments ?? []);
  const hand = s.id === localId && s.hand ? listCards(s.hand) : [];
  return makePlayerEntry({
    properties: makePlayerProperties({
      playerId: s.id,
      userInfo: makeUser({ name: s.user }),
      pingSeconds: 1,
      readyStart: true,
    }),
    deckList: deckListFor(s.commander),
    counters,
    zones: {
      [ZoneName.TABLE]: makeZoneEntry({ name: ZoneName.TABLE, type: 0, withCoords: true, cards: table, cardCount: table.length }),
      [ZoneName.HAND]: makeZoneEntry({
        name: ZoneName.HAND, type: 2, cards: hand, cardCount: s.id === localId ? hand.length : s.handCount,
      }),
      [ZoneName.DECK]: makeZoneEntry({ name: ZoneName.DECK, type: 2, cardCount: s.deck }),
      [ZoneName.GRAVE]: makeZoneEntry({ name: ZoneName.GRAVE, type: 0, cards: listCards(s.grave), cardCount: s.grave.length }),
      [ZoneName.EXILE]: makeZoneEntry({ name: ZoneName.EXILE, type: 0, cards: listCards(s.exile), cardCount: s.exile.length }),
      [ZoneName.SIDEBOARD]: makeZoneEntry({ name: ZoneName.SIDEBOARD, type: 2, cardCount: 0 }),
      [ZoneName.STACK]: makeZoneEntry({ name: ZoneName.STACK, type: 0, cards: [], cardCount: 0 }),
    },
  });
}

export interface LayoutGameOptions {
  players: number;
  spectator: boolean;
}

export function buildLayoutGame({ players: n, spectator }: LayoutGameOptions): GameEntry {
  nextCardId = 1000;
  const seated = SEATS.slice(0, n);
  const localId = spectator ? -1 : 1;
  const players: Record<number, PlayerEntry> = {};
  for (const s of seated) {
    players[s.id] = buildPlayer(s, localId);
  }
  return makeGameEntry({
    info: makeGameInfo({
      gameId: 1, roomId: 1, description: 'Commander · layout check',
      started: true, maxPlayers: n, playerCount: n, spectatorsAllowed: true, spectatorsCount: spectator ? 1 : 0,
    }),
    hostId: 1,
    localPlayerId: localId,
    spectator,
    started: true,
    activePlayerId: 1,
    activePhase: 3,
    secondsElapsed: 1010,
    players,
    seatOrder: seated.map((s) => s.id),
    messages: [],
  });
}
