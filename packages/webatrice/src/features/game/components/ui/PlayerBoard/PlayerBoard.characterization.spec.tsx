// Characterization barrier for the PlayerBoard seat surface (refactor plan Phase 0;
// written against PlayerBox, which PlayerBoard replaced in Phase 7).
//
// These specs pin what the seat does TODAY, end-to-end through <Game /> with real
// Redux state and a mock WebClient: which seats show what, which menu routes and
// dialogs exist, how selection feeds bulk commands, where drags land, how hidden
// zones are addressed, and that every global listener the seat installs is
// released. Later refactor phases move this behaviour into the seat model and the
// existing game owners; a failure here means a phase changed behaviour, not that
// the spec needs updating. Assertions are on the wire (`webClient.request.game.*`)
// wherever the seat sends a command, so they survive internal re-plumbing.

import { act, fireEvent, screen, within } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { makeCard } from '@cockatrice/datatrice/testing';
import { createMockWebClient, renderWithProviders } from '../../../../../__test-utils__';
import {
  battlefieldEl,
  buildSeatGameState,
  cardEl,
  chooseMenuPath,
  dismissMenus,
  LIFE_COUNTER_ID,
  layoutBoxes,
  menuLabels,
  openContextMenu,
  openMenus,
  pileEl,
  pointerDrag,
  type SeatGameSpec,
} from '../../../__test-utils__/seatFixtures';
import Game from '../../../Game';

vi.mock('../../../../../hooks/useSettings');

vi.mock('../../../../../services/cards/catalog/lookup', () => {
  const unknown = (name: string) => ({ found: false, source: 'unknown', name, printings: [] });
  return {
    lookupCard: vi.fn(async (name: string) => unknown(name)),
    lookupCards: vi.fn(async (inputs: Array<string | { name: string }>) =>
      new Map(inputs.map((i) => {
        const name = typeof i === 'string' ? i : i.name;
        return [name, unknown(name)];
      }))),
    lookupCardsCached: vi.fn(async (names: string[]) => new Map(names.map((n) => [n, unknown(n)]))),
    fetchAllPrintings: vi.fn(async () => []),
  };
});

const BOLT = makeCard({ id: 10, name: 'Bolt', x: 3, y: 1 });
const OGRE = makeCard({ id: 11, name: 'Ogre', x: 0, y: 0, tapped: true });
const SHOCK = makeCard({ id: 30, name: 'Shock' });
const OPT = makeCard({ id: 31, name: 'Opt' });
const BEAR = makeCard({ id: 20, name: 'Bear', x: 0, y: 0 });
const GRAVE_CARD = makeCard({ id: 40, name: 'Duress' });

function twoSeatGame(overrides: Partial<SeatGameSpec> = {}): SeatGameSpec {
  return {
    localPlayerId: 1,
    activePlayerId: 1,
    seats: [
      { playerId: 1, table: [BOLT, OGRE], hand: [SHOCK, OPT], grave: [GRAVE_CARD], deckCount: 40, sideboardCount: 15 },
      { playerId: 2, table: [BEAR], handCount: 5, grave: [makeCard({ id: 41, name: 'Thoughtseize' })], deckCount: 33 },
    ],
    ...overrides,
  };
}

function renderSeats(spec: SeatGameSpec = twoSeatGame()) {
  const webClient = createMockWebClient();
  const utils = renderWithProviders(<Game />, { preloadedState: buildSeatGameState(spec), webClient });
  return { ...utils, webClient, game: webClient.request.game };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PlayerBoard characterization — seats and hidden zones', () => {
  it('shows the local hand face-up and an opponent hand only as an authoritative count', () => {
    renderSeats();

    expect(cardEl(SHOCK.id, 'hand')).toHaveAttribute('data-card-id', '30');
    expect(cardEl(OPT.id, 'hand')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-card][data-zone="hand"]')).toHaveLength(2);

    expect(screen.getByTitle('Hand — 2 cards')).toBeEnabled();
    expect(screen.getByRole('img', { name: 'Hand, 5 cards' })).toBeInTheDocument();
  });

  it('renders library counts from cardCount, never from the (empty) hidden order', () => {
    renderSeats();

    expect(pileEl('Library', 0)).toHaveAttribute('title', 'Library, 40 cards');
    expect(pileEl('Library', 1)).toHaveAttribute('title', 'Library, 33 cards');
  });

  it('renders public piles with their top card and every battlefield with owner and mirroring', () => {
    renderSeats();

    expect(pileEl('Graveyard', 0)).toHaveAttribute('title', 'Graveyard, 1 card, top: Duress');
    expect(pileEl('Graveyard', 1)).toHaveAttribute('title', 'Graveyard, 1 card, top: Thoughtseize');
    expect(pileEl('Exile', 0)).toHaveAttribute('title', 'Exile, 0 cards');

    expect(battlefieldEl(1)).toHaveAttribute('data-battlefield-mirrored', 'false');
    expect(battlefieldEl(2)).toHaveAttribute('data-battlefield-mirrored', 'true');
    expect(within(battlefieldEl(1)).getByTitle('Bolt').closest('[data-card]')).toHaveAttribute('data-card-owner', '1');
    expect(within(battlefieldEl(2)).getByTitle('Bear').closest('[data-card]')).toHaveAttribute('data-card-owner', '2');
  });

  it('gives only the local seat an interactive life total', () => {
    renderSeats();

    expect(screen.getByRole('spinbutton', { name: 'P1\'s life' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'P2\'s life' })).not.toHaveAttribute('tabindex');
  });

  it('shows a spectator no hand strip and no face-up hand cards', () => {
    renderSeats(
      twoSeatGame({
        localPlayerId: 3,
        spectator: true,
        seats: [
          { playerId: 1, table: [BOLT], handCount: 4 },
          { playerId: 2, table: [BEAR], handCount: 5 },
        ],
      }),
    );

    expect(document.querySelectorAll('[data-card][data-zone="hand"]')).toHaveLength(0);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(battlefieldEl(1)).toBeInTheDocument();
    expect(battlefieldEl(2)).toBeInTheDocument();
  });
});

describe('PlayerBoard characterization — menu trees', () => {
  it('own library menu', async () => {
    renderSeats();
    expect(menuLabels(openContextMenu(pileEl('Library', 0)))).toEqual([
      'Draw card',
      'Draw cards...',
      'Undo last draw',
      'Shuffle',
      'View library',
      'View top cards of library...',
      'View bottom cards of library...',
      'Reveal library to...',
      'Lend library to...',
      'Reveal top cards to...',
      'Always reveal top card',
      'Always look at top card',
      'Top of library...',
      'Bottom of library...',
      'Open deck in deck editor (disabled)',
    ]);
    await dismissMenus();
    expect(openMenus()).toHaveLength(0);
  });

  it('opponent library has no menu', () => {
    renderSeats();
    act(() => {
      fireEvent.contextMenu(pileEl('Library', 1));
    });
    expect(openMenus()).toHaveLength(0);
  });

  it('own and opponent graveyard / exile menus', async () => {
    renderSeats();
    expect(menuLabels(openContextMenu(pileEl('Graveyard', 0)))).toEqual([
      'View graveyard',
      'Reveal random card to...',
      'Move graveyard to...',
    ]);
    await dismissMenus();
    expect(menuLabels(openContextMenu(pileEl('Graveyard', 1)))).toEqual(['View graveyard']);
    await dismissMenus();
    expect(menuLabels(openContextMenu(pileEl('Exile', 0)))).toEqual(['View exile', 'Move exile to... (disabled)']);
    await dismissMenus();
  });

  it('own hand menu', () => {
    renderSeats();
    expect(menuLabels(openContextMenu(pileEl('Hand', 0)))).toEqual([
      'View hand',
      'Sort hand by...',
      'Reveal hand to...',
      'Reveal random card to...',
      'Take mulligan (Choose hand size)',
      'Take mulligan (Same hand size)',
      'Take mulligan (Hand size - 1)',
      'Move hand to...',
    ]);
  });

  it('own and opponent battlefield-card menus', async () => {
    renderSeats();
    expect(menuLabels(openContextMenu(cardEl(BOLT.id, 'battlefield')))).toEqual([
      'Tap / Untap',
      'Skip untapping',
      'Turn Over',
      'Clone',
      'Move to',
      'Attach to card...',
      'Draw arrow...',
      'Power / toughness',
      'Set annotation...',
      'Reduce life by power',
      'Select All',
      'Select Row',
      'Card counters',
    ]);
    await dismissMenus();
    expect(menuLabels(openContextMenu(cardEl(BEAR.id, 'battlefield')))).toEqual([
      'Draw arrow...',
      'Clone',
      'Reduce life by power',
      'Select All',
      'Select Row',
    ]);
    await dismissMenus();
  });

  it('own and opponent battlefield (player) menus', async () => {
    renderSeats();
    expect(menuLabels(openContextMenu(battlefieldEl(1)))).toEqual([
      'Hand',
      'Library',
      'Graveyard',
      'Exile',
      'Sideboard',
      'Counters',
      'Increment all card counters',
      'Untap all permanents',
      'Roll die...',
      'Flip coin',
      'Create token...',
      'Create another token (disabled)',
      'Create predefined token (disabled)',
      'Game info...',
      'Tally',
      'Say (disabled)',
    ]);
    await dismissMenus();
    expect(menuLabels(openContextMenu(battlefieldEl(2)))).toEqual(['Graveyard', 'Exile', 'Tally']);
    await dismissMenus();
  });
});

describe('PlayerBoard characterization — commands from menus and dialogs', () => {
  it('library menu: draw, shuffle, undo draw', () => {
    const { game } = renderSeats();

    openContextMenu(pileEl('Library', 0));
    chooseMenuPath('Draw card');
    expect(game.drawCards).toHaveBeenCalledWith(1, { number: 1 });

    openContextMenu(pileEl('Library', 0));
    chooseMenuPath('Shuffle');
    expect(game.shuffle).toHaveBeenCalledWith(1, { zoneName: ZoneName.DECK, start: 0, end: -1 });

    openContextMenu(pileEl('Library', 0));
    chooseMenuPath('Undo last draw');
    expect(game.undoDraw).toHaveBeenCalledWith(1);
  });

  it('library menu: "Draw cards..." opens the draw dialog and sends its count', () => {
    const { game } = renderSeats();

    openContextMenu(pileEl('Library', 0));
    chooseMenuPath('Draw cards...');
    const dialog = screen.getByRole('dialog', { name: 'Draw cards' });
    fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Draw' }));

    expect(game.drawCards).toHaveBeenCalledWith(1, { number: 3 });
    expect(screen.queryByRole('dialog', { name: 'Draw cards' })).not.toBeInTheDocument();
  });

  it('library menu: reveal/lend to a player, and reveal to all omits playerId', () => {
    const { game } = renderSeats();

    openContextMenu(pileEl('Library', 0));
    chooseMenuPath('Reveal library to...', 'P2');
    expect(game.revealCards).toHaveBeenLastCalledWith(1, { zoneName: ZoneName.DECK, playerId: 2 });

    openContextMenu(pileEl('Library', 0));
    chooseMenuPath('Reveal library to...', 'All players');
    expect(game.revealCards).toHaveBeenLastCalledWith(1, { zoneName: ZoneName.DECK });

    openContextMenu(pileEl('Library', 0));
    chooseMenuPath('Lend library to...', 'P2');
    expect(game.revealCards).toHaveBeenLastCalledWith(1, {
      zoneName: ZoneName.DECK,
      playerId: 2,
      grantWriteAccess: true,
    });
  });

  it('library menu: always-reveal toggles change the deck zone properties', () => {
    const { game } = renderSeats();

    openContextMenu(pileEl('Library', 0));
    chooseMenuPath('Always reveal top card');
    expect(game.changeZoneProperties).toHaveBeenLastCalledWith(1, {
      zoneName: ZoneName.DECK,
      alwaysRevealTopCard: true,
    });

    openContextMenu(pileEl('Library', 0));
    chooseMenuPath('Always look at top card');
    expect(game.changeZoneProperties).toHaveBeenLastCalledWith(1, {
      zoneName: ZoneName.DECK,
      alwaysLookAtTopCard: true,
    });
  });

  it('graveyard menu: reveal random card uses the -2 random-card sentinel', () => {
    const { game } = renderSeats();

    openContextMenu(pileEl('Graveyard', 0));
    chooseMenuPath('Reveal random card to...', 'All players');
    expect(game.revealCards).toHaveBeenLastCalledWith(1, { zoneName: ZoneName.GRAVE, cardId: [-2] });
  });

  it('hand menu: same-size mulligan sends the current hand count', () => {
    const { game } = renderSeats();

    openContextMenu(pileEl('Hand', 0));
    chooseMenuPath('Take mulligan (Same hand size)');
    expect(game.mulligan).toHaveBeenCalledWith(1, { number: 2 });
  });

  it('battlefield menu: untap all uses the cardId=-1 whole-zone sentinel; flip coin is a d2', () => {
    const { game } = renderSeats();

    openContextMenu(battlefieldEl(1));
    chooseMenuPath('Untap all permanents');
    expect(game.setCardAttr).toHaveBeenLastCalledWith(1, {
      zone: ZoneName.TABLE,
      cardId: -1,
      attribute: CardAttribute.AttrTapped,
      attrValue: '0',
    });

    openContextMenu(battlefieldEl(1));
    chooseMenuPath('Flip coin');
    expect(game.rollDie).toHaveBeenLastCalledWith(1, { sides: 2, count: 1 });
  });

  it('battlefield menu: "Create token..." opens the seat token dialog and creates on the table', async () => {
    const { game } = renderSeats();

    openContextMenu(battlefieldEl(1));
    chooseMenuPath('Create token...');
    const dialog = screen.getByRole('dialog', { name: 'Create token' });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Soldier' } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Common.action.create' }));
    });

    expect(game.createToken).toHaveBeenCalledWith(1, expect.objectContaining({
      zone: ZoneName.TABLE,
      cardName: 'Soldier',
      x: -1,
    }));
  });

  it('card menu: tap, turn over, clone and move-to address the clicked card', () => {
    const { game } = renderSeats();

    openContextMenu(cardEl(BOLT.id, 'battlefield'));
    chooseMenuPath('Tap / Untap');
    expect(game.setCardAttr).toHaveBeenLastCalledWith(
      1,
      { zone: ZoneName.TABLE, cardId: BOLT.id, attribute: CardAttribute.AttrTapped, attrValue: '1' },
      undefined,
      expect.objectContaining({ onError: expect.any(Function) }),
    );

    openContextMenu(cardEl(BOLT.id, 'battlefield'));
    chooseMenuPath('Turn Over');
    expect(game.flipCard).toHaveBeenLastCalledWith(1, { zone: ZoneName.TABLE, cardId: BOLT.id, faceDown: true });

    openContextMenu(cardEl(BOLT.id, 'battlefield'));
    chooseMenuPath('Clone');
    expect(game.createToken).toHaveBeenLastCalledWith(1, expect.objectContaining({
      zone: ZoneName.TABLE,
      cardName: 'Bolt',
      destroyOnZoneChange: true,
      x: -1,
    }));

    openContextMenu(cardEl(BOLT.id, 'battlefield'));
    chooseMenuPath('Move to', 'Graveyard');
    expect(game.moveCard).toHaveBeenLastCalledWith(
      1,
      expect.objectContaining({
        startPlayerId: 1,
        startZone: ZoneName.TABLE,
        cardsToMove: { card: [{ cardId: BOLT.id }] },
        targetPlayerId: 1,
        targetZone: ZoneName.GRAVE,
      }),
      undefined,
      expect.anything(),
    );
  });

  it('life total: left click +1, right click -1 through the life counter', () => {
    const { game } = renderSeats();
    const life = screen.getByRole('spinbutton', { name: 'P1\'s life' });

    fireEvent.click(life);
    expect(game.incCounter).toHaveBeenLastCalledWith(
      1,
      { counterId: LIFE_COUNTER_ID, delta: 1 },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    fireEvent.contextMenu(life);
    expect(game.incCounter).toHaveBeenLastCalledWith(
      1,
      { counterId: LIFE_COUNTER_ID, delta: -1 },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it('routes "Roll die..." to the game-level roll-die dialog', () => {
    renderSeats();

    openContextMenu(battlefieldEl(1));
    chooseMenuPath('Roll die...');
    expect(screen.getByRole('dialog', { name: 'Roll Dice' })).toBeInTheDocument();
  });
});

describe('PlayerBoard characterization — selection and bulk operations', () => {
  it('a click below the drag threshold selects; ctrl-click adds; the card menu then targets the selection', () => {
    const { game } = renderSeats();

    pointerDrag(cardEl(BOLT.id, 'battlefield'), { x: 100, y: 100 }, { x: 102, y: 103 });
    act(() => {
      fireEvent.pointerDown(cardEl(OGRE.id, 'battlefield'), { button: 0, clientX: 50, clientY: 50 });
    });
    act(() => {
      fireEvent.pointerUp(window, { button: 0, clientX: 50, clientY: 50, ctrlKey: true });
    });
    expect(game.moveCard).not.toHaveBeenCalled();

    openContextMenu(cardEl(BOLT.id, 'battlefield'));
    chooseMenuPath('Move to', 'Exile');
    expect(game.moveCard).toHaveBeenCalledTimes(1);
    expect(game.moveCard).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        startZone: ZoneName.TABLE,
        targetZone: ZoneName.EXILE,
        cardsToMove: { card: [{ cardId: BOLT.id }, { cardId: OGRE.id }] },
      }),
    );
  });

  it('double-click taps the whole battlefield selection, sending the untapped cards', () => {
    const { game } = renderSeats();

    openContextMenu(cardEl(BOLT.id, 'battlefield'));
    chooseMenuPath('Select All');
    fireEvent.doubleClick(cardEl(OGRE.id, 'battlefield'));

    const tapped = vi.mocked(game.setCardAttr).mock.calls
      .map(([, params]) => params)
      .filter((p) => p.attribute === CardAttribute.AttrTapped);
    expect(tapped.map((p) => [p.cardId, p.attrValue])).toEqual([[BOLT.id, '1']]);
  });
});

describe('PlayerBoard characterization — drag and drop destinations', () => {
  const BF_BOX = { left: 0, top: 0, width: 800, height: 400 };
  const LIB_BOX = { left: 900, top: 200, width: 80, height: 110 };
  const GRAVE_BOX = { left: 981, top: 200, width: 80, height: 110 };
  const STACK_BOX = { left: 1100, top: 0, width: 100, height: 400 };
  const HAND_BOX = { left: 0, top: 500, width: 800, height: 120 };
  const SHOCK_BOX = { left: 0, top: 500, width: 72, height: 100 };
  const OPT_BOX = { left: 80, top: 500, width: 72, height: 100 };
  const STACK_CARD = makeCard({ id: 50, name: 'Counterspell' });

  function renderLaidOut() {
    const rendered = renderSeats(
      twoSeatGame({
        seats: [
          {
            playerId: 1,
            table: [BOLT, OGRE],
            hand: [SHOCK, OPT],
            grave: [GRAVE_CARD],
            stack: [STACK_CARD],
            deckCount: 40,
            sideboardCount: 15,
          },
          { playerId: 2, table: [BEAR], handCount: 5, deckCount: 33 },
        ],
      }),
    );
    const ownBf = battlefieldEl(1);
    const ownGrave = pileEl('Graveyard', 0);
    const ownLib = pileEl('Library', 0);
    const shock = cardEl(SHOCK.id, 'hand');
    const opt = cardEl(OPT.id, 'hand');
    const handRow = shock.closest('.overflow-x-auto');
    const stack = cardEl(STACK_CARD.id, 'stack').closest('.min-h-0.relative');
    layoutBoxes([
      [(el) => el === ownBf || el === ownBf.firstElementChild, BF_BOX],
      [(el) => el === ownGrave, GRAVE_BOX],
      [(el) => el === ownLib, LIB_BOX],
      [(el) => el === stack, STACK_BOX],
      [(el) => el === handRow, HAND_BOX],
      [(el) => el === shock, SHOCK_BOX],
      [(el) => el === opt, OPT_BOX],
    ]);
    return rendered;
  }

  const lastMove = (game: ReturnType<typeof renderSeats>['game']) => vi.mocked(game.moveCard).mock.calls.at(-1)?.[1];

  it('battlefield → own graveyard sends one TABLE→GRAVE move for the dragged card', () => {
    const { game } = renderLaidOut();

    pointerDrag(cardEl(BOLT.id, 'battlefield'), { x: 50, y: 50 }, { x: 1000, y: 250 });

    expect(game.moveCard).toHaveBeenCalledTimes(1);
    expect(lastMove(game)).toMatchObject({
      startPlayerId: 1,
      startZone: ZoneName.TABLE,
      cardsToMove: { card: [{ cardId: BOLT.id }] },
      targetPlayerId: 1,
      targetZone: ZoneName.GRAVE,
      x: 0,
      y: 0,
    });
  });

  it('library pile → graveyard addresses the hidden top card positionally (cardId 0)', () => {
    const { game } = renderLaidOut();

    pointerDrag(pileEl('Library', 0), { x: 920, y: 220 }, { x: 1000, y: 250 });

    expect(game.moveCard).toHaveBeenCalledTimes(1);
    expect(lastMove(game)).toMatchObject({
      startPlayerId: 1,
      startZone: ZoneName.DECK,
      cardsToMove: { card: [{ cardId: 0 }] },
      targetZone: ZoneName.GRAVE,
    });
  });

  it('a release within four pixels is a click; five pixels is a drag', () => {
    const { game } = renderLaidOut();

    pointerDrag(pileEl('Library', 0), { x: 978, y: 250 }, { x: 982, y: 250 });
    expect(game.moveCard).not.toHaveBeenCalled();

    pointerDrag(pileEl('Library', 0), { x: 978, y: 250 }, { x: 983, y: 250 });
    expect(game.moveCard).toHaveBeenCalledTimes(1);
    expect(lastMove(game)).toMatchObject({ startZone: ZoneName.DECK, targetZone: ZoneName.GRAVE });
  });

  it('graveyard → graveyard is a same-zone no-op', () => {
    const { game } = renderLaidOut();

    pointerDrag(pileEl('Graveyard', 0), { x: 990, y: 220 }, { x: 1020, y: 260 });

    expect(game.moveCard).not.toHaveBeenCalled();
  });

  it('hand → own battlefield snaps to a slot and takes the next free sub-slot of that stack', () => {
    const { game } = renderLaidOut();

    pointerDrag(cardEl(SHOCK.id, 'hand'), { x: 10, y: 510 }, { x: 15, y: 20 });

    expect(game.moveCard).toHaveBeenCalledTimes(1);
    expect(lastMove(game)).toMatchObject({
      startZone: ZoneName.HAND,
      cardsToMove: { card: [{ cardId: SHOCK.id }] },
      targetPlayerId: 1,
      targetZone: ZoneName.TABLE,
      x: 1,
      y: 0,
    });
  });

  it('hand → hand reorders to the post-removal insertion index', () => {
    const { game } = renderLaidOut();

    pointerDrag(cardEl(SHOCK.id, 'hand'), { x: 10, y: 510 }, { x: 200, y: 550 });

    expect(game.moveCard).toHaveBeenCalledTimes(1);
    expect(lastMove(game)).toMatchObject({
      startZone: ZoneName.HAND,
      cardsToMove: { card: [{ cardId: SHOCK.id }] },
      targetZone: ZoneName.HAND,
      x: 1,
    });
  });

  it('hand → stack inserts at the index under the pointer; stack → stack is a no-op', () => {
    const { game } = renderLaidOut();

    pointerDrag(cardEl(SHOCK.id, 'hand'), { x: 10, y: 510 }, { x: 1150, y: 390 });
    expect(game.moveCard).toHaveBeenCalledTimes(1);
    expect(lastMove(game)).toMatchObject({
      startZone: ZoneName.HAND,
      targetZone: ZoneName.STACK,
      x: 1,
    });

    pointerDrag(cardEl(STACK_CARD.id, 'stack'), { x: 1110, y: 10 }, { x: 1150, y: 390 });
    expect(game.moveCard).toHaveBeenCalledTimes(1);
  });

  it('opening the sideboard view dumps the hidden zone; a drop on it appends with x = -1', () => {
    const { game } = renderLaidOut();

    openContextMenu(battlefieldEl(1));
    chooseMenuPath('Sideboard', 'View sideboard');
    expect(game.dumpZone).toHaveBeenCalledWith(1, {
      playerId: 1,
      zoneName: ZoneName.SIDEBOARD,
      numberCards: -1,
      isReversed: false,
    });

    const dialog = screen.getByText('Sideboard — P1').closest<HTMLElement>('.pointer-events-auto.resize');
    expect(dialog).not.toBeNull();
    const ownBf = battlefieldEl(1);
    layoutBoxes([
      [(el) => el === dialog, { left: 1300, top: 0, width: 400, height: 400 }],
      [(el) => el === ownBf || el === ownBf.firstElementChild, BF_BOX],
    ]);

    pointerDrag(cardEl(BOLT.id, 'battlefield'), { x: 50, y: 50 }, { x: 1400, y: 100 });
    expect(lastMove(game)).toMatchObject({
      startZone: ZoneName.TABLE,
      cardsToMove: { card: [{ cardId: BOLT.id }] },
      targetZone: ZoneName.SIDEBOARD,
      x: -1,
    });
  });
});

describe('PlayerBoard characterization — global listener cleanup', () => {
  function trackListeners(target: Window | Document) {
    const live = new Map<string, Set<EventListenerOrEventListenerObject>>();
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
      if (listener) {
        live.set(type, (live.get(type) ?? new Set()).add(listener));
      }
      add(type, listener, options);
    });
    vi.spyOn(target, 'removeEventListener').mockImplementation((type, listener, options) => {
      if (listener) {
        live.get(type)?.delete(listener);
      }
      remove(type, listener, options);
    });
    return (type: string) => live.get(type)?.size ?? 0;
  }

  const SEAT_EVENTS = ['pointermove', 'pointerup', 'keydown', 'mousedown', 'click', 'mousemove'];

  it('releases drag and menu listeners when the interaction ends, and every listener on unmount', async () => {
    const windowLive = trackListeners(window);
    const documentLive = trackListeners(document);
    const { unmount } = renderSeats();
    const baseline = {
      pointermove: windowLive('pointermove'),
      pointerup: windowLive('pointerup'),
      mousedown: documentLive('mousedown'),
    };

    openContextMenu(pileEl('Library', 0));
    await dismissMenus();
    openContextMenu(cardEl(BOLT.id, 'battlefield'));
    await dismissMenus();
    expect(documentLive('mousedown')).toBe(baseline.mousedown);

    openContextMenu(pileEl('Library', 0));
    chooseMenuPath('Draw cards...');
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Draw cards' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Draw cards' })).not.toBeInTheDocument();

    act(() => {
      fireEvent.pointerDown(cardEl(BOLT.id, 'battlefield'), { button: 0, clientX: 50, clientY: 50 });
    });
    act(() => {
      fireEvent.pointerMove(window, { clientX: 80, clientY: 90 });
    });
    expect(document.body.style.cursor).toBe('grabbing');
    expect(windowLive('pointermove')).toBeGreaterThan(baseline.pointermove);
    act(() => {
      fireEvent.pointerUp(window, { button: 0, clientX: 80, clientY: 90 });
    });
    expect(document.body.style.cursor).toBe('');
    expect(windowLive('pointermove')).toBe(baseline.pointermove);
    expect(windowLive('pointerup')).toBe(baseline.pointerup);

    unmount();
    for (const type of SEAT_EVENTS) {
      expect({ type, window: windowLive(type), document: documentLive(type) })
        .toEqual({ type, window: 0, document: 0 });
    }
  });

  it('attaches the wheel-to-horizontal-scroll listeners as non-passive and removes them on unmount', () => {
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener');
    const { unmount } = renderSeats();

    const nonPassive = add.mock.calls
      .map((call, i) => ({ call, el: add.mock.contexts[i] }))
      .filter(({ call: [type, , options] }) => type === 'wheel' && (options as AddEventListenerOptions)?.passive === false);
    expect(nonPassive.length).toBeGreaterThanOrEqual(2);

    unmount();
    for (const { call: [, handler], el } of nonPassive) {
      expect(remove.mock.calls.some(([type, h], i) => type === 'wheel' && h === handler && remove.mock.contexts[i] === el))
        .toBe(true);
    }
  });
});
