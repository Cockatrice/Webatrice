
import { act, fireEvent, screen, within } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { games } from '@cockatrice/datatrice';
import { makeCard } from '@cockatrice/datatrice/testing';
import { Event_MoveCardSchema } from '@cockatrice/sockatrice/generated';
import { ZoneName } from '@cockatrice/sockatrice';

import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import {
  buildSeatGameState,
  cardEl,
  chooseMenuPath,
  openContextMenu,
  openMenus,
  pileEl,
  type SeatGameSpec,
} from './__test-utils__/seatFixtures';
import Game from './Game';

vi.mock('../../services/cards/catalog/lookup', async () =>
  (await import('./__test-utils__/unknownCardCatalog')).unknownCardCatalog());

const OGRE = makeCard({ id: 10, name: 'Ogre', x: 0, y: 0, pt: '3/3' });
const WALL = makeCard({ id: 12, name: 'Wall', x: 3, y: 0 });
const FOREST = makeCard({ id: 30, name: 'Forest' });
const ISLAND = makeCard({ id: 31, name: 'Island' });
const DURESS = makeCard({ id: 40, name: 'Duress' });
const BEAR = makeCard({ id: 20, name: 'Bear', x: 0, y: 0, pt: '2/2' });
const AURA = makeCard({ id: 21, name: 'Aura', x: 0, y: 0, attachPlayerId: 2, attachZone: ZoneName.TABLE, attachCardId: 20 });

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  activePlayerId: 1,
  seats: [
    { playerId: 1, name: 'Alice', table: [OGRE, WALL], hand: [FOREST, ISLAND], grave: [DURESS], deckCount: 40 },
    { playerId: 2, name: 'Bob', table: [BEAR, AURA], handCount: 5, deckCount: 33 },
  ],
};

function renderGameWithStore(spec: SeatGameSpec = SPEC) {
  const webClient = createMockWebClient();
  const { store } = renderWithProviders(<Game />, { preloadedState: buildSeatGameState(spec), webClient });
  return { game: webClient.request.game, store };
}

function renderGame() {
  return renderGameWithStore().game;
}

const key = (el: Element, init: { key: string; code?: string; shiftKey?: boolean }) => {
  act(() => {
    fireEvent.keyDown(el, { code: init.key === 'm' ? 'KeyM' : init.key, ...init });
  });
};
const focus = (el: HTMLElement) => act(() => el.focus());

describe('the board from the keyboard', () => {
  it('makes each zone\'s cards named options, one tab stop per zone', () => {
    renderGame();
    expect(screen.getByRole('listbox', { name: 'Alice\'s hand, 2 cards' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ogre, power and toughness 3/3' })).toBe(cardEl(OGRE.id, 'battlefield'));
    expect([FOREST, ISLAND].map((c) => cardEl(c.id, 'hand').tabIndex)).toEqual([0, -1]);
  });

  it('selects with the arrows and plays a hand card on Enter', async () => {
    const game = renderGame();
    const forest = cardEl(FOREST.id, 'hand');
    focus(forest);
    key(forest, { key: 'ArrowRight' });
    expect(cardEl(ISLAND.id, 'hand')).toHaveFocus();
    expect(cardEl(ISLAND.id, 'hand')).toHaveAttribute('aria-selected', 'true');

    key(cardEl(ISLAND.id, 'hand'), { key: 'Enter' });
    await vi.waitFor(() => expect(game.moveCard).toHaveBeenCalledTimes(1));
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      startZone: ZoneName.HAND,
      targetZone: ZoneName.STACK,
      cardsToMove: { card: [expect.objectContaining({ cardId: ISLAND.id })] },
    });
  });

  it('taps a battlefield card on Enter, the selection when the card is in it', () => {
    const game = renderGame();
    const ogre = cardEl(OGRE.id, 'battlefield');
    focus(ogre);
    key(ogre, { key: 'ArrowRight', shiftKey: true });
    expect(cardEl(WALL.id, 'battlefield')).toHaveFocus();
    key(cardEl(WALL.id, 'battlefield'), { key: 'Enter' });
    const tapped = Object.entries(game)
      .flatMap(([method, fn]) => (vi.isMockFunction(fn) ? fn.mock.calls.map((call) => [method, call[1]]) : []));
    expect(JSON.stringify(tapped)).toContain(String(OGRE.id));
    expect(JSON.stringify(tapped)).toContain(String(WALL.id));
  });

  it('moves a card to the graveyard through the menu Shift+F10 opens on it', () => {
    const game = renderGame();
    const forest = cardEl(FOREST.id, 'hand');
    focus(forest);
    key(forest, { key: 'F10', shiftKey: true });
    expect(openMenus()).toHaveLength(1);
    chooseMenuPath('Move to', 'Graveyard');
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      startZone: ZoneName.HAND,
      targetZone: ZoneName.GRAVE,
      cardsToMove: { card: [expect.objectContaining({ cardId: FOREST.id })] },
    });
  });

  it('leaves a zone with F6, where Tab would advance the phase', () => {
    renderGame();
    const ogre = cardEl(OGRE.id, 'battlefield');
    focus(ogre);
    key(ogre, { key: 'F6' });
    expect(document.activeElement).not.toBe(ogre);
    expect(document.activeElement?.closest('[data-card-id]')).not.toBe(ogre);
  });
});

describe('attach targets (desktop ArrowAttachItem::attachCards)', () => {
  const attach = (target: { playerId: number; cardId: number }) => ({
    startZone: ZoneName.TABLE,
    cardId: OGRE.id,
    targetPlayerId: target.playerId,
    targetZone: ZoneName.TABLE,
    targetCardId: target.cardId,
  });

  it('attaches to an opponent\'s card by pointer', () => {
    const game = renderGame();
    openContextMenu(cardEl(OGRE.id, 'battlefield'));
    chooseMenuPath('Attach to card...');
    act(() => {
      fireEvent.pointerDown(cardEl(BEAR.id, 'battlefield'), { button: 0, clientX: 5, clientY: 5 });
    });
    act(() => {
      fireEvent.pointerUp(window, { button: 0, clientX: 5, clientY: 5 });
    });
    expect(game.attachCard).toHaveBeenCalledTimes(1);
    expect(vi.mocked(game.attachCard).mock.calls[0][1]).toMatchObject(attach({ playerId: 2, cardId: BEAR.id }));
  });

  it('picks the target from the keyboard: focus a card, Enter', () => {
    const game = renderGame();
    const ogre = cardEl(OGRE.id, 'battlefield');
    focus(ogre);
    key(ogre, { key: 'F10', shiftKey: true });
    chooseMenuPath('Attach to card...');
    const bear = cardEl(BEAR.id, 'battlefield');
    focus(bear);
    key(bear, { key: 'Enter' });
    expect(vi.mocked(game.attachCard).mock.calls[0][1]).toMatchObject(attach({ playerId: 2, cardId: BEAR.id }));
  });

  it('refuses a card that is attached itself, cancelling the pick', () => {
    const game = renderGame();
    openContextMenu(cardEl(OGRE.id, 'battlefield'));
    chooseMenuPath('Attach to card...');
    const aura = cardEl(AURA.id, 'battlefield');
    focus(aura);
    key(aura, { key: 'Enter' });
    expect(game.attachCard).not.toHaveBeenCalled();
    const bear = cardEl(BEAR.id, 'battlefield');
    focus(bear);
    key(bear, { key: 'Enter' });
    expect(game.attachCard).not.toHaveBeenCalled();
  });
});

describe('arrow targets from the keyboard', () => {
  const arrowTo = (target: { playerId: number; zone: string; cardId: number }) => ({
    startPlayerId: 1,
    startZone: ZoneName.TABLE,
    startCardId: OGRE.id,
    targetPlayerId: target.playerId,
    targetZone: target.zone,
    targetCardId: target.cardId,
  });

  it('draws an arrow to the card Enter is pressed on, by the rule a click uses', () => {
    const game = renderGame();
    openContextMenu(cardEl(OGRE.id, 'battlefield'));
    chooseMenuPath('Draw arrow...');
    const bear = cardEl(BEAR.id, 'battlefield');
    focus(bear);
    key(bear, { key: 'Enter' });
    expect(game.createArrow).toHaveBeenCalledTimes(1);
    expect(vi.mocked(game.createArrow).mock.calls[0][1]).toMatchObject(arrowTo({ playerId: 2, zone: ZoneName.TABLE, cardId: BEAR.id }));
  });

  it('announces the pick, and that Escape cancels it', () => {
    renderGame();
    openContextMenu(cardEl(OGRE.id, 'battlefield'));
    chooseMenuPath('Draw arrow...');
    const prompt = 'Choose a target for the arrow from Ogre: press Enter on a card, or on a player\'s life. Escape cancels.';
    expect(screen.getByText(prompt)).toHaveAttribute('aria-live', 'polite');
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByText(prompt)).not.toBeInTheDocument();
  });

  it('draws an arrow to a player: their life takes focus and Enter while the pick is pending', () => {
    const game = renderGame();
    expect(screen.getByRole('group', { name: 'Bob\'s life' })).not.toHaveAttribute('tabindex');
    openContextMenu(cardEl(OGRE.id, 'battlefield'));
    chooseMenuPath('Draw arrow...');
    const bob = screen.getByRole('button', { name: 'Bob\'s life' });
    focus(bob);
    key(bob, { key: 'Enter' });
    expect(game.createArrow).toHaveBeenCalledTimes(1);
    expect(vi.mocked(game.createArrow).mock.calls[0][1]).toMatchObject({ startCardId: OGRE.id, targetPlayerId: 2 });
    expect(screen.getByRole('group', { name: 'Bob\'s life' })).toBeInTheDocument();
    expect(cardEl(OGRE.id, 'battlefield')).toHaveFocus();
  });

  it('draws an arrow to a card picked in a graveyard view', () => {
    const game = renderGame();
    const grave = pileEl('Graveyard');
    focus(grave);
    key(grave, { key: 'Enter' });
    chooseMenuPath('View graveyard');
    openContextMenu(cardEl(OGRE.id, 'battlefield'));
    chooseMenuPath('Draw arrow...');
    const duress = screen.getByRole('option', { name: 'Duress' });
    focus(duress);
    key(duress, { key: 'Enter' });
    expect(vi.mocked(game.createArrow).mock.calls[0][1]).toMatchObject(arrowTo({ playerId: 1, zone: ZoneName.GRAVE, cardId: DURESS.id }));
  });
});

describe('Escape during a target pick', () => {
  const PROMPT = /^Choose a target for the arrow from Ogre/;
  const startArrow = () => {
    openContextMenu(cardEl(OGRE.id, 'battlefield'));
    chooseMenuPath('Draw arrow...');
    expect(screen.getByText(PROMPT)).toBeInTheDocument();
  };

  it('cancels from another player\'s life and hands focus back to the arrow\'s card', () => {
    const game = renderGame();
    startArrow();
    const bob = screen.getByRole('button', { name: 'Bob\'s life' });
    focus(bob);
    act(() => {
      fireEvent.keyDown(bob, { key: 'Escape' });
    });
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Bob\'s life' })).not.toHaveAttribute('tabindex');
    expect(cardEl(OGRE.id, 'battlefield')).toHaveFocus();
    expect(game.createArrow).not.toHaveBeenCalled();
  });

  it('falls back to that player\'s menu button when the arrow\'s card is gone', () => {
    const { store } = renderGameWithStore();
    startArrow();
    const bob = screen.getByRole('button', { name: 'Bob\'s life' });
    focus(bob);
    act(() => {
      store.dispatch(games.Actions.cardMoved({
        gameId: 1,
        playerId: 1,
        data: create(Event_MoveCardSchema, {
          cardId: OGRE.id,
          cardName: OGRE.name,
          startPlayerId: 1,
          startZone: ZoneName.TABLE,
          targetPlayerId: 1,
          targetZone: ZoneName.GRAVE,
          newCardId: OGRE.id,
          x: 1,
        }),
      }));
    });
    expect(document.querySelector(`[data-zone="battlefield"][data-card-id="${OGRE.id}"]`)).toBeNull();
    act(() => {
      fireEvent.keyDown(bob, { key: 'Escape' });
    });
    expect(screen.getByRole('button', { name: 'Bob\'s player menu' })).toHaveFocus();
  });

  it('cancels the pick inside a card view and keeps the view open', () => {
    const game = renderGame();
    const grave = pileEl('Graveyard');
    focus(grave);
    key(grave, { key: 'Enter' });
    chooseMenuPath('View graveyard');
    startArrow();
    const duress = screen.getByRole('option', { name: 'Duress' });
    focus(duress);
    act(() => {
      fireEvent.keyDown(duress, { key: 'Escape' });
    });
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
    expect(duress).toBeInTheDocument();
    key(duress, { key: 'Enter' });
    expect(game.createArrow).not.toHaveBeenCalled();
    act(() => {
      fireEvent.keyDown(duress, { key: 'Escape' });
    });
    expect(screen.queryByRole('option', { name: 'Duress' })).not.toBeInTheDocument();
  });
});

describe('the player menu from the keyboard', () => {
  it('opens the menu a battlefield right-click opens from the player\'s menu button', () => {
    renderGame();
    const button = screen.getByRole('button', { name: 'Alice\'s player menu' });
    act(() => {
      fireEvent.click(button);
    });
    const menu = screen.getByRole('menu', { name: 'Player "Alice"' });
    expect(menu).toHaveTextContent('Create token...');
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('piles from the keyboard (G5)', () => {
  it('opens a pile view from the pile\'s menu, and closing the view returns focus to the pile', () => {
    renderGame();
    const grave = pileEl('Graveyard');
    expect(grave).toHaveAccessibleName('Graveyard, 1 card, top: Duress');
    focus(grave);
    key(grave, { key: 'Enter' });
    chooseMenuPath('View graveyard');
    expect(grave).not.toHaveFocus();
    const duress = screen.getByRole('option', { name: 'Duress' });
    focus(duress);
    key(duress, { key: 'Escape' });
    expect(screen.queryByRole('option', { name: 'Duress' })).not.toBeInTheDocument();
    expect(grave).toHaveFocus();
  });
});

describe('moving cards from the keyboard (M, aud.md G3)', () => {
  const moveDialog = () => screen.getByRole('dialog', { name: /^Move / });
  const choose = (label: string | RegExp, value: string) => {
    act(() => {
      fireEvent.change(within(moveDialog()).getByLabelText(label), { target: { value } });
    });
  };
  const optionValue = (label: string, option: string) => {
    const select = within(moveDialog()).getByLabelText(label) as HTMLSelectElement;
    return [...select.options].find((o) => o.textContent === option)!.value;
  };
  const submit = () => {
    act(() => {
      fireEvent.click(within(moveDialog()).getByRole('button', { name: 'Move' }));
    });
  };

  it('puts a hand card on another player\'s battlefield, at the row and column chosen', () => {
    const game = renderGame();
    const forest = cardEl(FOREST.id, 'hand');
    focus(forest);
    key(forest, { key: 'm', code: 'KeyM' });
    expect(moveDialog()).toHaveAccessibleName('Move Forest');
    expect(within(moveDialog()).getByLabelText('To')).toHaveFocus();
    choose('To', optionValue('To', 'Bob\'s battlefield'));
    choose('Row', optionValue('Row', 'Creatures row'));
    choose(/^Column \(1 to /, '1');
    submit();
    expect(game.moveCard).toHaveBeenCalledTimes(1);
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      startPlayerId: 1, startZone: ZoneName.HAND, cardsToMove: { card: [{ cardId: FOREST.id }] },
      targetPlayerId: 2, targetZone: ZoneName.TABLE, x: 0, y: 1,
    });
    expect(screen.queryByRole('dialog', { name: /^Move / })).not.toBeInTheDocument();
  });

  it.each([1, 2])('offers the shared board width on an empty row of seat %s', (playerId) => {
    const { game } = renderGameWithStore({
      ...SPEC,
      seats: SPEC.seats.map((seat) => seat.playerId === playerId
        ? { ...seat, table: [makeCard({ id: 90, name: 'Wide row', x: 18, y: 0 })] }
        : seat),
    });
    const forest = cardEl(FOREST.id, 'hand');
    focus(forest);
    key(forest, { key: 'm' });
    choose('To', `battlefield:${playerId}`);
    choose('Row', '2');
    choose('Column (1 to 8)', '8');
    submit();
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      targetPlayerId: playerId, targetZone: ZoneName.TABLE, x: 21, y: 2,
    });
  });

  it('inserts a battlefield card into the hand at the position chosen, and keeps focus on the board', () => {
    const game = renderGame();
    const ogre = cardEl(OGRE.id, 'battlefield');
    focus(ogre);
    key(ogre, { key: 'm', code: 'KeyM' });
    choose('To', 'hand');
    choose('Position (1 to 3; 3 is the end)', '1');
    submit();
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      startZone: ZoneName.TABLE, cardsToMove: { card: [{ cardId: OGRE.id }] }, targetZone: ZoneName.HAND, x: 0,
    });
    expect(document.activeElement?.getAttribute('role')).toBe('option');
  });

  it('cancels on Escape, sends nothing and hands focus back to the card', () => {
    const game = renderGame();
    const ogre = cardEl(OGRE.id, 'battlefield');
    focus(ogre);
    key(ogre, { key: 'm', code: 'KeyM' });
    act(() => {
      fireEvent.keyDown(within(moveDialog()).getByLabelText('To'), { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog', { name: /^Move / })).not.toBeInTheDocument();
    expect(game.moveCard).not.toHaveBeenCalled();
    expect(ogre).toHaveFocus();
  });

  const layer = (el: Element): number => {
    let z = 0;
    for (let node: Element | null = el; node; node = node.parentElement) {
      const match = /(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?:\s|$)/.exec(node.getAttribute('class') ?? '');
      if (match) {
        z = Number(match[1] ?? match[2]);
      }
    }
    return z;
  };

  it('opens over the card view it was opened from, and moves a view card from the keyboard', () => {
    const game = renderGame();
    const grave = pileEl('Graveyard');
    focus(grave);
    key(grave, { key: 'Enter' });
    chooseMenuPath('View graveyard');
    const duress = screen.getByRole('option', { name: 'Duress' });
    focus(duress);
    key(duress, { key: 'm', code: 'KeyM' });
    expect(layer(moveDialog())).toBeGreaterThan(layer(duress));
    choose('To', 'exile');
    submit();
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      startZone: ZoneName.GRAVE, cardsToMove: { card: [{ cardId: DURESS.id }] }, targetZone: ZoneName.EXILE,
    });
  });

  it('reorders two cards picked in the hand view by the hand order a drag on the strip uses', () => {
    const SWAMP = makeCard({ id: 32, name: 'Swamp' });
    const PLAINS = makeCard({ id: 33, name: 'Plains' });
    const { game } = renderGameWithStore({
      ...SPEC,
      seats: [{ ...SPEC.seats[0], hand: [FOREST, ISLAND, SWAMP, PLAINS] }, SPEC.seats[1]],
    });
    openContextMenu(pileEl('Hand'));
    chooseMenuPath('View hand');
    const view = screen.getByRole('heading', { name: /hand/i }).closest<HTMLElement>('.pointer-events-auto.resize')!;
    const forest = within(view).getByRole('option', { name: 'Forest' });
    const island = within(view).getByRole('option', { name: 'Island' });
    focus(forest);
    key(forest, { key: ' ' });
    focus(island);
    key(island, { key: ' ' });
    key(island, { key: 'm', code: 'KeyM' });
    expect(moveDialog()).toHaveAccessibleName('Move 2 cards');
    choose('To', 'hand');
    choose('Position (1 to 3; 3 is the end)', '3');
    submit();
    expect(vi.mocked(game.moveCard).mock.calls.map(([, params]) => [params.cardsToMove!.card![0].cardId, params.x]))
      .toEqual([[FOREST.id, 3], [ISLAND.id, 3]]);
  });

  it.each([
    ['View top cards of library...', /^view top cards of library$/i, false, [0, 1, 2]],
    ['View bottom cards of library...', /^view bottom cards of library$/i, true, [37, 38, 39]],
  ] as const)('moves a card of a %s view from the keyboard, by its deck position', (item, prompt, isReversed, positions) => {
    const { game, store } = renderGameWithStore();
    openContextMenu(pileEl('Library'));
    chooseMenuPath(item);
    const countPrompt = screen.getByRole('dialog', { name: prompt });
    fireEvent.change(within(countPrompt).getByRole('spinbutton'), { target: { value: '3' } });
    act(() => {
      fireEvent.click(within(countPrompt).getByRole('button', { name: 'View' }));
    });
    act(() => {
      store.dispatch(games.Actions.zoneViewRevealed({
        gameId: 1,
        playerId: 1,
        zoneName: ZoneName.DECK,
        cards: ['Alpha', 'Beta', 'Gamma'].map((name, i) => makeCard({ id: positions[i], name })),
        isReversed,
      }));
    });
    const beta = screen.getByRole('option', { name: 'Beta' });
    focus(beta);
    key(beta, { key: 'm', code: 'KeyM' });
    expect(layer(moveDialog())).toBeGreaterThan(layer(beta));
    choose('To', 'graveyard');
    submit();
    expect(game.moveCard).toHaveBeenCalledTimes(1);
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      startPlayerId: 1, startZone: ZoneName.DECK, cardsToMove: { card: [{ cardId: positions[1] }] }, targetZone: ZoneName.GRAVE,
    });
  });

  it('opens nothing on a card the player may not move', () => {
    renderGame();
    const bear = cardEl(BEAR.id, 'battlefield');
    focus(bear);
    key(bear, { key: 'm', code: 'KeyM' });
    expect(screen.queryByRole('dialog', { name: /^Move / })).not.toBeInTheDocument();
  });
});
