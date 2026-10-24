import { ZoneName } from '@cockatrice/sockatrice';
import type { ActionId } from '@app/feature-widgets/shortcuts';
import { catalogT } from '../../../__test-utils__/catalogT';
import menuText from '../menus.i18n.json';
import zoneText from '../../../dialogs/shared/zoneLabels.i18n.json';

import type { SeatCardMenuState } from '../../../hooks/dialogs/gameDialogs.types';
import { makeCardKey } from '../../../utils/CardRegistry/CardRegistryContext';
import type { ContextMenuItem as CardMenuItem } from '../ContextMenu/ContextMenu';
import {
  playCardMove,
  resolveHandOrZoneCardMenu,
  selectedHiddenZoneCards,
  type HandOrZoneCardMenuDeps,
} from './handCardMenu.actions';

const menuShortcut = (id: ActionId) => ({ shortcut: `<${id}>`, keyShortcuts: '' });
const t = catalogT(menuText, zoneText);

const OWNER = 1;
const card = (id: string, name: string) => ({ id, name, scryfallId: `sf-${id}` });
const HAND = [card('10', 'Island'), card('11', 'Grizzly Bears'), card('12', 'Shock')];
const LIBRARY = [card('20', 'Forest'), card('21', 'Llanowar Elves')];
const SIDEBOARD = [card('30', 'Naturalize')];
const META: Record<string, { typeLine: string }> = {
  'Island': { typeLine: 'Basic Land — Island' },
  'Grizzly Bears': { typeLine: 'Creature — Bear' },
  'Shock': { typeLine: 'Instant' },
  'Llanowar Elves': { typeLine: 'Creature — Elf Druid' },
};

const handMenu = (cardId: string): SeatCardMenuState => ({ kind: 'hand', playerId: OWNER, cardId, x: 5, y: 6 });
const libraryViewMenu = (cardId: string, zone: string = ZoneName.DECK): SeatCardMenuState => ({
  kind: 'zoneView',
  playerId: OWNER,
  zone,
  cardId,
  cardName: 'From view',
  x: 7,
  y: 8,
  viewCardIds: ['20', '21'],
  columnCardIds: ['21'],
});

function makeDeps(overrides: Partial<HandOrZoneCardMenuDeps> = {}): HandOrZoneCardMenuDeps {
  return {
    t,
    menu: handMenu('11'),
    ownerId: OWNER,
    menuShortcut,
    canModify: true,
    revealTargets: [{ playerId: 2, name: 'Bob' }],
    handCards: HAND,
    zoneViewCards: LIBRARY,
    handSelection: null,
    setHandSelection: vi.fn(),
    selectedCardKeys: new Set(),
    setSelectedCardKeys: vi.fn(),
    cardMeta: (name) => META[name],
    deckSize: 40,
    moveCards: vi.fn(),
    revealCards: vi.fn(),
    cloneCard: vi.fn(),
    promptMoveXFromTop: vi.fn(),
    startArrow: vi.fn(),
    relatedViewItems: () => [],
    tokenItems: () => [],
    close: vi.fn(),
    ...overrides,
  };
}

function click(items: CardMenuItem[], ...path: string[]) {
  let level = items;
  let found: Exclude<CardMenuItem, { divider: true }> | undefined;
  for (const label of path) {
    found = level.find((i): i is Exclude<CardMenuItem, { divider: true }> => 'label' in i && i.label === label);
    if (!found) {
      throw new Error(`no item ${label}`);
    }
    level = found.submenu ?? [];
  }
  found!.onClick!();
}

function itemsOf(deps: HandOrZoneCardMenuDeps): CardMenuItem[] {
  const popup = resolveHandOrZoneCardMenu(deps);
  if (!popup) {
    throw new Error('menu did not resolve');
  }
  return popup.items;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveHandOrZoneCardMenu', () => {
  it('renders nothing for other seat menus', () => {
    expect(resolveHandOrZoneCardMenu(makeDeps({ menu: null }))).toBeNull();
    expect(resolveHandOrZoneCardMenu(makeDeps({
      menu: { kind: 'battlefield', playerId: OWNER, cardId: '1', x: 0, y: 0 },
    }))).toBeNull();
  });

  it('anchors at the click and names the menu after the card', () => {
    const popup = resolveHandOrZoneCardMenu(makeDeps())!;
    expect(popup.anchor).toEqual({ x: 5, y: 6 });
    expect(popup.label).toBe('Grizzly Bears');
  });

  it('acts on the clicked card when it is outside the hand selection', () => {
    const deps = makeDeps({ handSelection: { zone: 'hand', ids: new Set(['10', '12']) } });
    click(itemsOf(deps), 'Move to', 'Graveyard');
    expect(deps.moveCards).toHaveBeenCalledWith(ZoneName.HAND, [11], { zone: ZoneName.GRAVE, reversed: false });
    expect(deps.close).toHaveBeenCalledTimes(1);
  });

  it('acts on the whole hand selection when the clicked card is part of it', () => {
    const deps = makeDeps({ handSelection: { zone: 'hand', ids: new Set(['10', '11']) } });
    click(itemsOf(deps), 'Move to', 'Bottom of library in random order');
    expect(deps.moveCards).toHaveBeenCalledWith(ZoneName.HAND, [10, 11], { zone: ZoneName.DECK, reversed: true, shuffleMoved: true });
  });

  it('moves each target onto the battlefield in its own row, with its P/T and cipt', () => {
    const deps = makeDeps({
      handSelection: { zone: 'hand', ids: new Set(['10', '11', '12']) },
      cardMeta: (name) => ({ ...META[name], ...(name === 'Grizzly Bears' && { pt: '2/2' }), ...(name === 'Island' && { cipt: true }) }),
    });
    click(itemsOf(deps), 'Move to', 'Table');
    expect(vi.mocked(deps.moveCards!).mock.calls).toEqual([
      [ZoneName.HAND, [{ id: 10, tapped: true }], { zone: ZoneName.TABLE, index: 'end', row: 2 }],
      [ZoneName.HAND, [{ id: 11, pt: '2/2' }], { zone: ZoneName.TABLE, index: 'end', row: 0 }],
      [ZoneName.HAND, [12], { zone: ZoneName.TABLE, index: 'end', row: 1 }],
    ]);
  });

  it('acts on the selected cards of a zone view that include the clicked card', () => {
    const deps = makeDeps({
      menu: libraryViewMenu('21'),
      selectedCardKeys: new Set([makeCardKey(OWNER, ZoneName.DECK, 20), makeCardKey(OWNER, ZoneName.DECK, 21)]),
    });
    click(itemsOf(deps), 'Move to', 'Exile');
    expect(deps.moveCards).toHaveBeenCalledWith(ZoneName.DECK, [20, 21], { zone: ZoneName.EXILE, reversed: false });
  });

  it('reads a sideboard view\'s cards from the sideboard', () => {
    const deps = makeDeps({ menu: libraryViewMenu('30', ZoneName.SIDEBOARD), zoneViewCards: SIDEBOARD });
    click(itemsOf(deps), 'Move to', 'Hand');
    expect(deps.moveCards).toHaveBeenCalledWith(ZoneName.SIDEBOARD, [30], { zone: ZoneName.HAND, reversed: false });
  });

  it('plays each target to the row its type line picks, one move per card', () => {
    const deps = makeDeps({ handSelection: { zone: 'hand', ids: new Set(['10', '11', '12']) } });
    click(itemsOf(deps), 'Play');
    expect(vi.mocked(deps.moveCards!).mock.calls).toEqual([
      [ZoneName.HAND, [12], { zone: ZoneName.STACK, index: 'end' }],
      [ZoneName.HAND, [11], { zone: ZoneName.TABLE, index: 'end', row: 0 }],
      [ZoneName.HAND, [10], { zone: ZoneName.TABLE, index: 'end', row: 2 }],
    ]);
  });

  it.each([ZoneName.DECK, ZoneName.SIDEBOARD])('plays positional cards descending from %s', (zone) => {
    const deps = makeDeps({
      menu: libraryViewMenu('21', zone),
      zoneViewCards: LIBRARY,
      selectedCardKeys: new Set([makeCardKey(OWNER, zone, 20), makeCardKey(OWNER, zone, 21)]),
    });
    click(itemsOf(deps), 'Play');
    expect(vi.mocked(deps.moveCards!).mock.calls.map((call) => call[1])).toEqual([[21], [20]]);
  });

  it('honours playToStack for menu Play while lands and face-down cards stay on the table', () => {
    const deps = makeDeps({ playToStack: true, handSelection: { zone: 'hand', ids: new Set(['10', '11']) } });
    click(itemsOf(deps), 'Play');
    expect(deps.moveCards).toHaveBeenCalledWith(ZoneName.HAND, [11], { zone: ZoneName.STACK, index: 'end' });
    expect(deps.moveCards).toHaveBeenCalledWith(ZoneName.HAND, [10], { zone: ZoneName.TABLE, index: 'end', row: 2 });
    vi.mocked(deps.moveCards!).mockClear();
    click(itemsOf(deps), 'Play Face Down');
    expect(vi.mocked(deps.moveCards!).mock.calls.every((call) => call[2].zone === ZoneName.TABLE)).toBe(true);
  });

  it('plays a creature with its printed P/T', () => {
    const deps = makeDeps({ cardMeta: () => ({ typeLine: 'Creature — Bear', pt: '2/2' }) });
    click(itemsOf(deps), 'Play');
    expect(deps.moveCards).toHaveBeenCalledWith(
      ZoneName.HAND,
      [{ id: 11, pt: '2/2' }],
      { zone: ZoneName.TABLE, index: 'end', row: 0 },
    );
  });

  it('plays face down to row 2', () => {
    const deps = makeDeps({ menu: handMenu('12') });
    click(itemsOf(deps), 'Play Face Down');
    expect(deps.moveCards).toHaveBeenCalledWith(
      ZoneName.HAND,
      [{ id: 12, faceDown: true }],
      { zone: ZoneName.TABLE, index: 'end', row: 0 },
    );
  });

  it('reveals the targets to one player or to everyone', () => {
    const deps = makeDeps();
    const items = itemsOf(deps);
    click(items, 'Reveal to...', 'Bob');
    click(items, 'Reveal to...', 'All players');
    expect(vi.mocked(deps.revealCards!).mock.calls).toEqual([
      [ZoneName.HAND, 2, [11]],
      [ZoneName.HAND, -1, [11]],
    ]);
  });

  it('clones each target onto the table', () => {
    const deps = makeDeps();
    click(itemsOf(deps), 'Clone');
    expect(deps.cloneCard).toHaveBeenCalledWith({
      name: 'Grizzly Bears', providerId: 'sf-11', color: '', pt: '', annotation: '', y: 0,
    });
  });

  it('asks how deep before moving into the library', () => {
    const deps = makeDeps({ menu: libraryViewMenu('21') });
    click(itemsOf(deps), 'Move to', 'X cards from the top of library...');
    expect(deps.promptMoveXFromTop).toHaveBeenCalledWith({
      cardIds: [21], cardName: 'Llanowar Elves', deckSize: 40, fromZone: ZoneName.DECK,
    });
  });

  it('moves the whole selection X cards from the top in one move', () => {
    const deps = makeDeps({ handSelection: { zone: 'hand', ids: new Set(['10', '11']) } });
    click(itemsOf(deps), 'Move to', 'X cards from the top of library...');
    expect(deps.promptMoveXFromTop).toHaveBeenCalledWith({
      cardIds: [10, 11], cardName: 'Grizzly Bears', deckSize: 40, fromZone: ZoneName.HAND,
    });
  });

  it('starts an arrow from a hand card', () => {
    const deps = makeDeps();
    click(itemsOf(deps), 'Draw arrow...');
    expect(deps.startArrow).toHaveBeenCalledWith({ sourceCardId: 11, sourceCardName: 'Grizzly Bears', sourceZone: ZoneName.HAND });
  });

  it('selects the whole hand, or the view and its column', () => {
    const hand = makeDeps();
    click(itemsOf(hand), 'Select All');
    expect(hand.setHandSelection).toHaveBeenCalledWith({ zone: 'hand', ids: new Set(['10', '11', '12']) });

    const view = makeDeps({ menu: libraryViewMenu('21') });
    const items = itemsOf(view);
    click(items, 'Select All');
    click(items, 'Select Column');
    expect(vi.mocked(view.setSelectedCardKeys).mock.calls).toEqual([
      [new Set([makeCardKey(OWNER, ZoneName.DECK, 20), makeCardKey(OWNER, ZoneName.DECK, 21)])],
      [new Set([makeCardKey(OWNER, ZoneName.DECK, 21)])],
    ]);
  });

  it('asks for related and token items by the clicked card\'s name', () => {
    const relatedViewItems = vi.fn(() => []);
    const tokenItems = vi.fn(() => []);
    resolveHandOrZoneCardMenu(makeDeps({ menu: handMenu('12'), relatedViewItems, tokenItems }));
    expect(relatedViewItems).toHaveBeenCalledWith('Shock');
    expect(tokenItems).toHaveBeenCalledWith('Shock');
  });
});

describe('playCardMove', () => {
  it('sends only row 3 to the stack from the menu, and all but lands on double-click', () => {
    expect(playCardMove(1, { typeLine: 'Sorcery' }).to).toEqual({ zone: ZoneName.STACK, index: 'end' });
    expect(playCardMove(1, { typeLine: 'Creature — Bear' }).to).toEqual({ zone: ZoneName.TABLE, index: 'end', row: 0 });
    expect(playCardMove(1, { typeLine: 'Creature — Bear' }, { playToStack: true }).to)
      .toEqual({ zone: ZoneName.STACK, index: 'end' });
    expect(playCardMove(1, { typeLine: 'Land' }, { playToStack: true }).to)
      .toEqual({ zone: ZoneName.TABLE, index: 'end', row: 2 });
  });

  it('lands a face-up card with its printed P/T, tapped when cipt', () => {
    expect(playCardMove(1, { typeLine: 'Creature — Bear', pt: '2/2' }).card).toEqual({ id: 1, pt: '2/2' });
    expect(playCardMove(1, { typeLine: 'Land', cipt: true }).card).toEqual({ id: 1, tapped: true });
    expect(playCardMove(1, { typeLine: 'Artifact' }).card).toBe(1);
    expect(playCardMove(1, { typeLine: 'Creature — Bear', pt: '2/2', cipt: true }, { faceDown: true }).card)
      .toEqual({ id: 1, faceDown: true });
  });

  it('resolves a stack card: instants and sorceries to the graveyard, the rest to the battlefield', () => {
    expect(playCardMove(1, { typeLine: 'Instant' }, { fromStack: true }))
      .toEqual({ card: 1, to: { zone: ZoneName.GRAVE, index: 'end' } });
    expect(playCardMove(1, { typeLine: 'Creature — Bear', pt: '2/2' }, { fromStack: true, playToStack: true }))
      .toEqual({ card: { id: 1, pt: '2/2' }, to: { zone: ZoneName.TABLE, index: 'end', row: 0 } });
  });

  it('puts a face-down card in row 2 whatever its type', () => {
    expect(playCardMove(1, { typeLine: 'Instant' }, { faceDown: true })).toEqual({
      card: { id: 1, faceDown: true },
      to: { zone: ZoneName.TABLE, index: 'end', row: 0 },
    });
  });
});

describe('selectedHiddenZoneCards', () => {
  it('takes the hand selection first', () => {
    expect(selectedHiddenZoneCards(OWNER, { zone: 'hand', ids: new Set(['10', 'x', '12']) }, new Set()))
      .toEqual({ zone: ZoneName.HAND, cardIds: [10, 12] });
  });

  it('takes the selected cards of one of the seat\'s library or sideboard views', () => {
    const keys = new Set([makeCardKey(OWNER, ZoneName.SIDEBOARD, 30), makeCardKey(OWNER, ZoneName.SIDEBOARD, 31)]);
    expect(selectedHiddenZoneCards(OWNER, null, keys)).toEqual({ zone: ZoneName.SIDEBOARD, cardIds: [30, 31] });
  });

  it('ignores a selection elsewhere, on another seat, or across zones', () => {
    expect(selectedHiddenZoneCards(OWNER, { zone: 'battlefield', ids: new Set(['1']) }, new Set())).toBeNull();
    expect(selectedHiddenZoneCards(OWNER, null, new Set([makeCardKey(OWNER, ZoneName.GRAVE, 1)]))).toBeNull();
    expect(selectedHiddenZoneCards(OWNER, null, new Set([makeCardKey(2, ZoneName.DECK, 1)]))).toBeNull();
    expect(selectedHiddenZoneCards(OWNER, null, new Set([
      makeCardKey(OWNER, ZoneName.DECK, 1),
      makeCardKey(OWNER, ZoneName.SIDEBOARD, 2),
    ]))).toBeNull();
  });
});
