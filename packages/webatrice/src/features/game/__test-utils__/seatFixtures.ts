// Shared fixtures for the game-seat characterization specs
// (PlayerBoard.characterization, GameBoardCell, Game.dragdrop, Game.orchestration).
//
// The seat surface is driven end-to-end through real Redux state, so these
// helpers build a `games` slice with explicit per-zone contents and the
// Servatrice-shaped counter set (life + the seven mana counters), plus the DOM
// helpers the specs share for menus, pointer drags and jsdom layout.

import { createElement } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import type { ServerInfo_Card, ServerInfo_PlayerProperties_PlaymatParams } from '@cockatrice/sockatrice/generated';
import { ServerInfo_Zone_ZoneType } from '@cockatrice/sockatrice/generated';
import {
  makeCounter,
  makeGameEntry,
  makeGameInfo,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';
import {
  connected31State,
  connectedState,
  createMockWebClient,
  makeStoreState,
  makeUser,
  renderWithProviders,
} from '../../../__test-utils__';
import GameBoardCell from '../components/ui/GameBoardCell/GameBoardCell';
import type { BoardCell } from '../hooks/useGameBoardLayout';
import { ReplayRewindProvider } from '../components/ui/ReplayRewindContext';

export const LIFE_COUNTER_ID = 1;

const MANA_COUNTER_NAMES = ['w', 'u', 'b', 'r', 'g', 'x', 'storm'] as const;
export const MANA_COUNTER_IDS: Record<(typeof MANA_COUNTER_NAMES)[number], number> = {
  w: 2,
  u: 3,
  b: 4,
  r: 5,
  g: 6,
  x: 7,
  storm: 8,
};

export interface SeatSpec {
  playerId: number;
  name?: string;
  table?: ServerInfo_Card[];
  hand?: ServerInfo_Card[];
  handCount?: number;
  deckCount?: number;
  grave?: ServerInfo_Card[];
  exile?: ServerInfo_Card[];
  stack?: ServerInfo_Card[];
  sideboardCount?: number;
  life?: number;
  deckList?: string;
  playmat?: ServerInfo_PlayerProperties_PlaymatParams;
}

export interface SeatGameSpec {
  localPlayerId: number;
  seats: SeatSpec[];
  activePlayerId?: number;
  hostId?: number;
  started?: boolean;
  spectator?: boolean;
  judge?: boolean;
  omniscient?: boolean;
  server31?: boolean;
}

function counterSet(life: number) {
  const counters: Record<number, ReturnType<typeof makeCounter>> = {
    [LIFE_COUNTER_ID]: makeCounter({ id: LIFE_COUNTER_ID, name: 'life', count: life }),
  };
  for (const name of MANA_COUNTER_NAMES) {
    const id = MANA_COUNTER_IDS[name];
    counters[id] = makeCounter({ id, name, count: 0 });
  }
  return counters;
}

export function makeSeat(seat: SeatSpec) {
  const zone = (name: (typeof ZoneName)[keyof typeof ZoneName], cards: ServerInfo_Card[] = [], cardCount = cards.length) =>
    makeZoneEntry({
      name, cards, cardCount,
      type: name === ZoneName.DECK || name === ZoneName.SIDEBOARD
        ? ServerInfo_Zone_ZoneType.HiddenZone : ServerInfo_Zone_ZoneType.PublicZone,
    });
  return makePlayerEntry({
    properties: makePlayerProperties({
      playerId: seat.playerId,
      userInfo: makeUser({ name: seat.name ?? `P${seat.playerId}` }),
      playmatParams: seat.playmat,
    }),
    deckList: seat.deckList ?? '',
    counters: counterSet(seat.life ?? 20),
    zones: {
      [ZoneName.TABLE]: zone(ZoneName.TABLE, seat.table),
      [ZoneName.HAND]: zone(ZoneName.HAND, seat.hand, seat.handCount ?? seat.hand?.length ?? 0),
      [ZoneName.DECK]: zone(ZoneName.DECK, [], seat.deckCount ?? 40),
      [ZoneName.GRAVE]: zone(ZoneName.GRAVE, seat.grave),
      [ZoneName.EXILE]: zone(ZoneName.EXILE, seat.exile),
      [ZoneName.STACK]: zone(ZoneName.STACK, seat.stack),
      [ZoneName.SIDEBOARD]: zone(ZoneName.SIDEBOARD, [], seat.sideboardCount ?? 0),
    },
  });
}

export function buildSeatGameState({
  localPlayerId,
  seats,
  activePlayerId = seats[0]?.playerId ?? 0,
  hostId = localPlayerId,
  started = true,
  spectator = false,
  judge = false,
  omniscient = false,
  server31 = false,
}: SeatGameSpec) {
  const players: Record<number, ReturnType<typeof makePlayerEntry>> = {};
  for (const seat of seats) {
    players[seat.playerId] = makeSeat(seat);
  }
  return makeStoreState({
    ...(server31 ? connected31State : connectedState),
    games: {
      games: {
        1: makeGameEntry({
          localPlayerId,
          hostId,
          spectator,
          judge,
          started,
          activePlayerId,
          players,
          info: makeGameInfo({ started, spectatorsOmniscient: omniscient }),
        }),
      },
    },
  });
}

export function renderSeatHook<T>(
  useHook: () => T,
  spec: SeatGameSpec,
  mutate?: (state: ReturnType<typeof buildSeatGameState>) => void,
) {
  const preloadedState = buildSeatGameState(spec);
  mutate?.(preloadedState);
  const webClient = createMockWebClient();
  let latest: T | undefined;
  function Probe() {
    latest = useHook();
    return null;
  }
  const utils = renderWithProviders(createElement(Probe), { preloadedState, webClient });
  return { ...utils, result: () => latest as T, game: webClient.request.game };
}

export function renderSeatCell(
  spec: SeatGameSpec,
  playerId: number = spec.localPlayerId,
  {
    rewindCount,
    ...options
  }: Omit<Parameters<typeof renderWithProviders>[1], 'preloadedState' | 'webClient'> & { rewindCount?: () => number } = {},
) {
  const preloadedState = buildSeatGameState(spec);
  const webClient = createMockWebClient();
  const isLocal = playerId === spec.localPlayerId;
  const canAct = isLocal || !!spec.judge;
  const cell: BoardCell = { playerId, isLocal, mirrored: !isLocal, canAct, showHand: isLocal, row: 0, col: 0 };
  const board = createElement(GameBoardCell, { cell, totalPlayers: spec.seats.length });
  const utils = renderWithProviders(
    rewindCount ? createElement(ReplayRewindProvider, { value: rewindCount }, board) : board,
    { ...options, preloadedState, webClient },
  );
  return { ...utils, game: webClient.request.game };
}

const MENU_SELECTOR = '[role="menu"]';

export function openMenus(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(MENU_SELECTOR));
}

export function menuLabels(menu: HTMLElement): string[] {
  return Array.from(menu.querySelectorAll<HTMLButtonElement>(':scope > div > button, :scope > button')).map(
    (button) => {
      const label = button.querySelector('span.flex-1')?.textContent?.trim() ?? '';
      return button.disabled || button.getAttribute('aria-disabled') === 'true' ? `${label} (disabled)` : label;
    },
  );
}

export function openContextMenu(el: Element): HTMLElement {
  const before = new Set(openMenus());
  act(() => {
    fireEvent.contextMenu(el, { clientX: 10, clientY: 10 });
  });
  const opened = openMenus().filter((menu) => !before.has(menu));
  if (opened.length !== 1) {
    throw new Error(`expected one new menu, found ${opened.length}`);
  }
  return opened[0];
}

function findMenuButton(label: string): HTMLButtonElement {
  for (const menu of openMenus().reverse()) {
    for (const button of menu.querySelectorAll<HTMLButtonElement>('button')) {
      if (button.querySelector('span.flex-1')?.textContent?.trim() === label) {
        return button;
      }
    }
  }
  throw new Error(`no open menu item labelled "${label}"`);
}

export function chooseMenuPath(...labels: string[]) {
  labels.forEach((label, i) => {
    const button = findMenuButton(label);
    if (i < labels.length - 1 && button.getAttribute('role') !== 'menuitem') {
      act(() => {
        fireEvent.mouseEnter(button);
      });
    } else {
      act(() => {
        fireEvent.click(button);
      });
    }
  });
}

export async function dismissMenus() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  for (let i = 0; i < 5 && openMenus().length > 0; i++) {
    act(() => {
      fireEvent.keyDown(openMenus()[0], { key: 'Escape' });
    });
  }
}

export function cardEl(cardId: number, zone?: 'battlefield' | 'hand' | 'stack'): HTMLElement {
  const selector = zone ? `[data-card][data-zone="${zone}"][data-card-id="${cardId}"]` : `[data-card][data-card-id="${cardId}"]`;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) {
    throw new Error(`no card element for ${selector}`);
  }
  return el;
}

export function battlefieldEl(ownerId: number): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-battlefield-owner="${ownerId}"]`);
  if (!el) {
    throw new Error(`no battlefield for player ${ownerId}`);
  }
  return el;
}

export function pileEl(label: 'Library' | 'Graveyard' | 'Exile' | 'Hand', seatIndex = 0): HTMLElement {
  const all = screen.getAllByTitle(new RegExp(`^${label}(?:, | — )`));
  const inTray = (el: HTMLElement) => el.closest('[data-testid="board-tray"]') != null;
  return [...all.filter(inTray), ...all.filter((el) => !inTray(el))][seatIndex];
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const OFFSCREEN: Box = { left: -10_000, top: -10_000, width: 0, height: 0 };

function toRect({ left, top, width, height }: Box): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

export function layoutBoxes(boxes: Array<[(el: Element) => boolean, Box]>) {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function boxFor(this: Element) {
    for (const [matches, box] of boxes) {
      if (matches(this)) {
        return toRect(box);
      }
    }
    return toRect(OFFSCREEN);
  });
}

export function pointerDrag(source: Element, from: { x: number; y: number }, to: { x: number; y: number }) {
  act(() => {
    fireEvent.pointerDown(source, { button: 0, clientX: from.x, clientY: from.y });
  });
  act(() => {
    fireEvent.pointerMove(window, { clientX: to.x, clientY: to.y });
  });
  act(() => {
    fireEvent.pointerUp(window, { button: 0, clientX: to.x, clientY: to.y });
  });
}
