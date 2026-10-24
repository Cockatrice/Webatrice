
import { act, fireEvent, screen } from '@testing-library/react';
import { makeCard } from '@cockatrice/datatrice/testing';

import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import { usePreference } from '../../hooks/useSettings';
import { PREFERENCE_DEFAULTS, type PreferenceKey } from '../../types';
import {
  buildSeatGameState,
  cardEl,
  chooseMenuPath,
  dismissMenus,
  openContextMenu,
  openMenus,
  pileEl,
  type SeatGameSpec,
} from './__test-utils__/seatFixtures';
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
const MORPH = makeCard({ id: 12, name: 'Morph', x: 6, y: 1, faceDown: true, doesntUntap: true });
const BEAR = makeCard({ id: 20, name: 'Bear', x: 0, y: 0 });
const OWN_SPELL = makeCard({ id: 50, name: 'Counterspell' });
const THEIR_SPELL = makeCard({ id: 51, name: 'Shock' });
const OWN_GRAVE = makeCard({ id: 40, name: 'Duress' });
const OWN_EXILE = makeCard({ id: 42, name: 'Rest' });
const THEIR_GRAVE = makeCard({ id: 41, name: 'Thoughtseize' });

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  activePlayerId: 1,
  seats: [
    { playerId: 1, table: [BOLT, MORPH], stack: [OWN_SPELL], grave: [OWN_GRAVE], exile: [OWN_EXILE], hand: [], deckCount: 40 },
    { playerId: 2, table: [BEAR], stack: [THEIR_SPELL], grave: [THEIR_GRAVE], handCount: 5, deckCount: 33 },
  ],
};

function renderSeats() {
  return renderWithProviders(<Game />, { preloadedState: buildSeatGameState(SPEC), webClient: createMockWebClient() });
}

function menuRows(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.children).flatMap((child) => {
    if (child instanceof HTMLButtonElement) {
      return [child];
    }
    const button = child.querySelector(':scope > button');
    return [(button as HTMLElement | null) ?? (child as HTMLElement)];
  });
}

function serializeMenu(menu: HTMLElement, depth = 0): string[] {
  const pad = '  '.repeat(depth);
  const lines: string[] = [];
  for (const row of menuRows(menu)) {
    if (!(row instanceof HTMLButtonElement)) {
      lines.push(`${pad}---`);
      continue;
    }
    const label = row.querySelector('span.flex-1')?.textContent?.trim() ?? '';
    const spans = Array.from(row.querySelectorAll('span'));
    const swatch = spans.find((s) => s.classList.contains('rounded-full'))?.style.background;
    const checked = spans.some((s) => s.textContent === '✓');
    const hasSubmenu = row.getAttribute('aria-haspopup') === 'menu';
    const shortcut = spans
      .find((s) => s.classList.contains('text-xs') && s.textContent !== '' && s.textContent !== '✓')
      ?.textContent?.trim();
    const parts = [
      checked ? '✓ ' : '',
      swatch ? `●${swatch} ` : '',
      label,
      shortcut ? `  ⟨${shortcut}⟩` : '',
      row.disabled || row.getAttribute('aria-disabled') === 'true' ? '  (disabled)' : '',
      hasSubmenu ? '  ▶' : '',
    ];
    lines.push(pad + parts.join(''));
    if (hasSubmenu) {
      act(() => {
        fireEvent.click(row);
      });
      const controls = row.getAttribute('aria-controls');
      const submenu = controls ? document.getElementById(controls) : null;
      if (submenu) {
        lines.push(...serializeMenu(submenu, depth + 1));
      }
    }
  }
  return lines;
}

function menuTree(target: Element): string {
  return `\n${serializeMenu(openContextMenu(target)).join('\n')}\n`;
}

function pileViewCard(cardId: number): HTMLElement {
  const matches = document.querySelectorAll<HTMLElement>(`[data-card][data-card-id="${cardId}"]`);
  return matches[matches.length - 1];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('seat card menu trees', () => {
  it('own battlefield card, face up', async () => {
    renderSeats();
    expect(menuTree(cardEl(BOLT.id, 'battlefield'))).toMatchInlineSnapshot(`
      "
      Tap / Untap
      Skip untapping  ⟨Alt+U⟩
      Turn Over  ⟨Alt+F⟩
      ---
      Clone  ⟨Ctrl+J⟩
      Move to  ▶
        Top of library in random order
        X cards from the top of library...
        Bottom of library in random order  ⟨Ctrl+B⟩
        ---
        Table
        Hand
        ---
        Graveyard  ⟨Ctrl+Delete⟩
        Exile
      ---
      Attach to card...  ⟨Ctrl+Alt+A⟩
      Draw arrow...  ⟨Alt+A⟩
      ---
      Power / toughness  ▶
        Increase power  ⟨Ctrl+=⟩
        Decrease power  ⟨Ctrl+-⟩
        Increase power and decrease toughness
        ---
        Increase toughness  ⟨Alt+=⟩
        Decrease toughness  ⟨Alt+-⟩
        Decrease power and increase toughness
        ---
        Increase power and toughness  ⟨Ctrl+Alt+=⟩
        Decrease power and toughness  ⟨Ctrl+Alt+-⟩
        ---
        Set power and toughness...  ⟨Ctrl+P⟩
        Reset power and toughness  ⟨Ctrl+Alt+0⟩
      Set annotation...  ⟨Alt+N⟩
      ---
      Reduce life by power  ⟨Ctrl+Shift+L⟩
      ---
      Select All  ⟨Ctrl+A⟩
      Select Row  ⟨Ctrl+Shift+X⟩
      ---
      Card counters  ▶
        ●var(--card-counter-0, #FF6969) Add counter (A)  ⟨Alt+.⟩
        ●var(--card-counter-0, #FF6969) Set counters (A)...  ⟨Alt+/⟩
        ---
        ●var(--card-counter-1, #FFFF69) Add counter (B)  ⟨Ctrl+.⟩
        ●var(--card-counter-1, #FFFF69) Set counters (B)...  ⟨Ctrl+/⟩
        ---
        ●var(--card-counter-2, #69FF69) Add counter (C)  ⟨Ctrl+Shift+.⟩
        ●var(--card-counter-2, #69FF69) Set counters (C)...  ⟨Ctrl+Shift+/⟩
        ---
        ●var(--card-counter-3, #69FFFF) Add counter (D)
        ●var(--card-counter-3, #69FFFF) Set counters (D)...
        ---
        ●var(--card-counter-4, #6969FF) Add counter (E)
        ●var(--card-counter-4, #6969FF) Set counters (E)...
        ---
        ●var(--card-counter-5, #FF69FF) Add counter (F)
        ●var(--card-counter-5, #FF69FF) Set counters (F)...
      "
    `);
    await dismissMenus();
    expect(openMenus()).toHaveLength(0);
  });

  it('own battlefield card, face down and not untapping', () => {
    renderSeats();
    expect(menuTree(cardEl(MORPH.id, 'battlefield'))).toMatchInlineSnapshot(`
      "
      Tap / Untap
      ✓ Skip untapping  ⟨Alt+U⟩
      Turn Over (face up)  ⟨Alt+F⟩
      Peek at card face  ⟨Alt+L⟩
      ---
      Clone  ⟨Ctrl+J⟩
      Move to  ▶
        Top of library in random order
        X cards from the top of library...
        Bottom of library in random order  ⟨Ctrl+B⟩
        ---
        Table
        Hand
        ---
        Graveyard  ⟨Ctrl+Delete⟩
        Exile
      ---
      Attach to card...  ⟨Ctrl+Alt+A⟩
      Draw arrow...  ⟨Alt+A⟩
      ---
      Power / toughness  ▶
        Increase power  ⟨Ctrl+=⟩
        Decrease power  ⟨Ctrl+-⟩
        Increase power and decrease toughness
        ---
        Increase toughness  ⟨Alt+=⟩
        Decrease toughness  ⟨Alt+-⟩
        Decrease power and increase toughness
        ---
        Increase power and toughness  ⟨Ctrl+Alt+=⟩
        Decrease power and toughness  ⟨Ctrl+Alt+-⟩
        ---
        Set power and toughness...  ⟨Ctrl+P⟩
        Reset power and toughness  ⟨Ctrl+Alt+0⟩
      Set annotation...  ⟨Alt+N⟩
      ---
      Reduce life by power  ⟨Ctrl+Shift+L⟩
      ---
      Select All  ⟨Ctrl+A⟩
      Select Row  ⟨Ctrl+Shift+X⟩
      ---
      Card counters  ▶
        ●var(--card-counter-0, #FF6969) Add counter (A)  ⟨Alt+.⟩
        ●var(--card-counter-0, #FF6969) Set counters (A)...  ⟨Alt+/⟩
        ---
        ●var(--card-counter-1, #FFFF69) Add counter (B)  ⟨Ctrl+.⟩
        ●var(--card-counter-1, #FFFF69) Set counters (B)...  ⟨Ctrl+/⟩
        ---
        ●var(--card-counter-2, #69FF69) Add counter (C)  ⟨Ctrl+Shift+.⟩
        ●var(--card-counter-2, #69FF69) Set counters (C)...  ⟨Ctrl+Shift+/⟩
        ---
        ●var(--card-counter-3, #69FFFF) Add counter (D)
        ●var(--card-counter-3, #69FFFF) Set counters (D)...
        ---
        ●var(--card-counter-4, #6969FF) Add counter (E)
        ●var(--card-counter-4, #6969FF) Set counters (E)...
        ---
        ●var(--card-counter-5, #FF69FF) Add counter (F)
        ●var(--card-counter-5, #FF69FF) Set counters (F)...
      "
    `);
  });

  it('opponent battlefield card', () => {
    renderSeats();
    expect(menuTree(cardEl(BEAR.id, 'battlefield'))).toMatchInlineSnapshot(`
      "
      Draw arrow...  ⟨Alt+A⟩
      Clone  ⟨Ctrl+J⟩
      ---
      Reduce life by power  ⟨Ctrl+Shift+L⟩
      ---
      Select All  ⟨Ctrl+A⟩
      Select Row  ⟨Ctrl+Shift+X⟩
      "
    `);
  });

  it('own stack card', () => {
    renderSeats();
    expect(menuTree(cardEl(OWN_SPELL.id, 'stack'))).toMatchInlineSnapshot(`
      "
      Play
      Play Face Down
      ---
      Clone  ⟨Ctrl+J⟩
      Move to  ▶
        Hand
        Table
        Graveyard
        Exile
        ---
        Top of library
        Bottom of library
      ---
      Attach to card...  ⟨Ctrl+Alt+A⟩
      Draw arrow...  ⟨Alt+A⟩
      ---
      Select All  ⟨Ctrl+A⟩
      "
    `);
  });

  it('opponent stack card', () => {
    renderSeats();
    expect(menuTree(cardEl(THEIR_SPELL.id, 'stack'))).toMatchInlineSnapshot(`
      "
      Draw arrow...  ⟨Alt+A⟩
      ---
      Clone  ⟨Ctrl+J⟩
      ---
      Select All  ⟨Ctrl+A⟩
      "
    `);
  });

  it('own graveyard pile-view card', async () => {
    renderSeats();
    openContextMenu(pileEl('Graveyard', 0));
    chooseMenuPath('View graveyard');
    expect(screen.getByText(/^Graveyard — P1/)).toBeInTheDocument();

    expect(menuTree(pileViewCard(OWN_GRAVE.id))).toMatchInlineSnapshot(`
      "
      Draw arrow...  ⟨Alt+A⟩
      Clone  ⟨Ctrl+J⟩
      Select All  ⟨Ctrl+A⟩
      Select Column  ⟨Ctrl+Shift+C⟩
      "
    `);
  });

  it('own exile pile-view card', () => {
    renderSeats();
    openContextMenu(pileEl('Exile', 0));
    chooseMenuPath('View exile');

    expect(menuTree(pileViewCard(OWN_EXILE.id))).toMatchInlineSnapshot(`
      "
      Draw arrow...  ⟨Alt+A⟩
      Clone  ⟨Ctrl+J⟩
      Select All  ⟨Ctrl+A⟩
      Select Column  ⟨Ctrl+Shift+C⟩
      "
    `);
  });

  it('opponent graveyard pile-view card', () => {
    renderSeats();
    openContextMenu(pileEl('Graveyard', 1));
    chooseMenuPath('View graveyard');

    expect(menuTree(pileViewCard(THEIR_GRAVE.id))).toMatchInlineSnapshot(`
      "
      Draw arrow...  ⟨Alt+A⟩
      Clone  ⟨Ctrl+J⟩
      Select All  ⟨Ctrl+A⟩
      Select Column  ⟨Ctrl+Shift+C⟩
      "
    `);
  });
});

function zLayer(el: Element): number {
  const layered = el.closest('[class*="z-["]');
  const match = layered?.className.toString().match(/z-\[(\d+)\]/);
  return match ? Number(match[1]) : 0;
}

describe('seat card menu ownership', () => {
  it('keeps one card menu open across seats: opening another closes the first', () => {
    renderSeats();

    openContextMenu(cardEl(BOLT.id, 'battlefield'));
    act(() => {
      fireEvent.contextMenu(cardEl(BEAR.id, 'battlefield'), { clientX: 30, clientY: 30 });
    });

    const menus = openMenus();
    expect(menus).toHaveLength(1);
    expect(menus[0]).toHaveTextContent('Reduce life by power');
    expect(menus[0]).not.toHaveTextContent('Tap / Untap');
  });

  it('closes when one of its items fires', () => {
    renderSeats();

    openContextMenu(cardEl(OWN_SPELL.id, 'stack'));
    chooseMenuPath('Select All');

    expect(openMenus()).toHaveLength(0);
  });

  it('draws a pile-view card menu above the pile view', () => {
    renderSeats();
    openContextMenu(pileEl('Graveyard', 0));
    chooseMenuPath('View graveyard');
    const card = pileViewCard(OWN_GRAVE.id);

    const menu = openContextMenu(card);

    expect(zLayer(menu)).toBeGreaterThan(zLayer(card));
    expect(menu.parentElement).toBe(document.body);
  });

  it('leaves the shortcut hints out with "Show keyboard shortcuts in right-click menus" off', () => {
    vi.mocked(usePreference).mockImplementation(((key: PreferenceKey) =>
      key === 'showShortcutsInMenus' ? false : PREFERENCE_DEFAULTS[key]) as typeof usePreference);
    renderSeats();

    const tree = menuTree(cardEl(BOLT.id, 'battlefield'));

    expect(tree).toContain('Tap / Untap');
    expect(tree).not.toContain('⟨');
    vi.mocked(usePreference).mockImplementation(((key: PreferenceKey) => PREFERENCE_DEFAULTS[key]) as typeof usePreference);
  });
});

describe('hand card menu', () => {
  const OPT = makeCard({ id: 60, name: 'Opt' });
  const PONDER = makeCard({ id: 61, name: 'Ponder' });

  function renderHand() {
    const webClient = createMockWebClient();
    renderWithProviders(<Game />, {
      preloadedState: buildSeatGameState({
        localPlayerId: 1,
        seats: [
          { playerId: 1, hand: [OPT, PONDER], deckCount: 40 },
          { playerId: 2, name: 'Bob', handCount: 5, deckCount: 33 },
        ],
      }),
      webClient,
    });
    return webClient.request.game;
  }

  it('Reveal to... a player sends one revealCards for the clicked card', () => {
    const game = renderHand();
    openContextMenu(cardEl(OPT.id, 'hand'));
    chooseMenuPath('Reveal to...', 'Bob');

    expect(game.revealCards).toHaveBeenCalledTimes(1);
    expect(game.revealCards).toHaveBeenCalledWith(1, { zoneName: 'hand', cardId: [60], playerId: 2 });
    expect(openMenus()).toHaveLength(0);
  });

  it('reveals the whole selection to all players without a player id', () => {
    const game = renderHand();
    openContextMenu(cardEl(OPT.id, 'hand'));
    chooseMenuPath('Select All');
    openContextMenu(cardEl(PONDER.id, 'hand'));
    chooseMenuPath('Reveal to...', 'All players');

    expect(game.revealCards).toHaveBeenCalledTimes(1);
    expect(game.revealCards).toHaveBeenCalledWith(1, { zoneName: 'hand', cardId: [60, 61] });
  });

  it('plays a card face down onto the battlefield', () => {
    const game = renderHand();
    openContextMenu(cardEl(PONDER.id, 'hand'));
    chooseMenuPath('Play Face Down');

    expect(game.moveCard).toHaveBeenCalledTimes(1);
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      startZone: 'hand',
      targetZone: 'table',
      cardsToMove: { card: [{ cardId: 61, faceDown: true }] },
    });
  });
});
