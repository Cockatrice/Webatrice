
import { act, fireEvent, screen } from '@testing-library/react';
import { makeCard } from '@cockatrice/datatrice/testing';

import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import { usePreference } from '../../hooks/useSettings';
import { PREFERENCE_DEFAULTS, type PreferenceKey } from '../../types';
import { buildSeatGameState, cardEl, openContextMenu, pointerDrag, type SeatGameSpec } from './__test-utils__/seatFixtures';
import Game from './Game';

vi.mock('../../hooks/useSettings');

vi.mock('../../services/cards/catalog/lookup', () => {
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
const OGRE = makeCard({ id: 11, name: 'Ogre', x: 0, y: 0 });
const SHOCK = makeCard({ id: 30, name: 'Shock' });
const BEAR = makeCard({ id: 20, name: 'Bear', x: 0, y: 0 });

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  seats: [
    { playerId: 1, table: [BOLT, OGRE], hand: [SHOCK], deckCount: 40 },
    { playerId: 2, table: [BEAR], handCount: 5, deckCount: 40 },
  ],
};

function renderGame(webClient = createMockWebClient()) {
  return renderWithProviders(<Game />, { preloadedState: buildSeatGameState(SPEC), webClient });
}

function click(el: Element, init: { ctrlKey?: boolean } = {}) {
  act(() => {
    fireEvent.pointerDown(el, { button: 0, clientX: 50, clientY: 50 });
  });
  act(() => {
    fireEvent.pointerUp(window, { button: 0, clientX: 50, clientY: 50, ...init });
  });
}

const selected = () =>
  Array.from(document.querySelectorAll('[data-card][data-selected]')).map(
    (el) => `${el.getAttribute('data-zone')}:${el.getAttribute('data-card-id')}`,
  );

describe('Game selection across seats', () => {
  it('keeps selected cards when pressing a portalled hand submenu item', () => {
    renderGame();
    click(cardEl(BOLT.id, 'battlefield'));
    click(cardEl(OGRE.id, 'battlefield'), { ctrlKey: true });
    const selection = [`battlefield:${BOLT.id}`, `battlefield:${OGRE.id}`];
    expect(selected().sort()).toEqual(selection);

    openContextMenu(screen.getByRole('button', { name: 'Hand — 1 card' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reveal hand to...' }));
    const item = screen.getByRole('menuitem', { name: 'All players' });
    fireEvent.pointerDown(item, { button: 0, clientX: 10, clientY: 10 });
    expect(selected().sort()).toEqual(selection);
    fireEvent.pointerMove(window, { clientX: 100, clientY: 100 });
    expect(selected().sort()).toEqual(selection);
    fireEvent.pointerUp(window, { button: 0 });
    fireEvent.click(item);
    expect(selected().sort()).toEqual(selection);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(usePreference).mockImplementation(((key: PreferenceKey) => PREFERENCE_DEFAULTS[key]) as typeof usePreference);
  });

  it('holds one selection for the whole game: selecting on another seat clears this one', () => {
    renderGame();

    click(cardEl(BOLT.id, 'battlefield'));
    expect(selected()).toEqual([`battlefield:${BOLT.id}`]);

    pointerDrag(document.querySelector(`[data-card][data-card-id="${BEAR.id}"]`)!, { x: 50, y: 50 }, { x: 51, y: 51 });
    expect(selected()).toEqual([`battlefield:${BEAR.id}`]);
  });

  it('keeps a selection to one zone: ctrl-click adds within it and replaces across zones', () => {
    renderGame();

    click(cardEl(BOLT.id, 'battlefield'));
    click(cardEl(OGRE.id, 'battlefield'), { ctrlKey: true });
    expect(selected().sort()).toEqual([`battlefield:${BOLT.id}`, `battlefield:${OGRE.id}`]);

    click(cardEl(SHOCK.id, 'hand'), { ctrlKey: true });
    expect(selected()).toEqual([`hand:${SHOCK.id}`]);
  });

  it('clears with the game-level Escape like any other selection', () => {
    renderGame();
    click(cardEl(BOLT.id, 'battlefield'));

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(selected()).toEqual([]);
  });

  it('dies with the game: a new game starts with nothing selected', () => {
    const first = renderGame();
    click(cardEl(BOLT.id, 'battlefield'));
    expect(selected()).toEqual([`battlefield:${BOLT.id}`]);
    first.unmount();

    renderGame();
    expect(selected()).toEqual([]);
    click(cardEl(OGRE.id, 'battlefield'));
    expect(selected()).toEqual([`battlefield:${OGRE.id}`]);
  });

  it('plays on a single click, after selecting, once "Double-click cards to play them" is off', () => {
    vi.mocked(usePreference).mockImplementation(((key: PreferenceKey) =>
      key === 'doubleClickToPlay' ? false : PREFERENCE_DEFAULTS[key]) as typeof usePreference);
    const webClient = createMockWebClient();
    renderGame(webClient);

    click(cardEl(BOLT.id, 'battlefield'));

    expect(selected()).toEqual([`battlefield:${BOLT.id}`]);
    expect(webClient.request.game.setCardAttr).toHaveBeenCalledTimes(1);
    expect(vi.mocked(webClient.request.game.setCardAttr).mock.calls[0][1]).toMatchObject({ cardId: BOLT.id, attrValue: '1' });
  });

  it('only selects on a single click while double-click plays', () => {
    const webClient = createMockWebClient();
    renderGame(webClient);

    click(cardEl(BOLT.id, 'battlefield'));

    expect(selected()).toEqual([`battlefield:${BOLT.id}`]);
    expect(webClient.request.game.setCardAttr).not.toHaveBeenCalled();
  });

  it('leaves the focus on the chat when the board is pressed, with "Keep game chat focused" on', () => {
    const first = renderGame();
    expect(fireEvent.mouseDown(cardEl(BOLT.id, 'battlefield'))).toBe(true);
    first.unmount();

    vi.mocked(usePreference).mockImplementation(((key: PreferenceKey) =>
      key === 'keepGameChatFocus' ? true : PREFERENCE_DEFAULTS[key]) as typeof usePreference);
    renderGame();
    expect(fireEvent.mouseDown(cardEl(BOLT.id, 'battlefield'))).toBe(false);
    expect(fireEvent.mouseDown(screen.getByLabelText('ChatLog.inputLabel'))).toBe(true);
  });
});
