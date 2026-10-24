
import { act, fireEvent, renderHook, screen, within } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { games } from '@cockatrice/datatrice';
import { makeCard } from '@cockatrice/datatrice/testing';
import { ShortcutProvider } from '@app/feature-widgets/shortcuts';

import { createMockWebClient, renderWithProviders } from '../../../../__test-utils__';
import { catalogT } from '../../__test-utils__/catalogT';
import { buildSeatGameState, chooseMenuPath, openMenus } from '../../__test-utils__/seatFixtures';
import Game from '../../Game';
import { GameReadOnlyProvider } from '../../components/ui/GameReadOnlyContext';
import { useTallyType } from '../../hooks/useTallyType';
import zoneLabels from '../shared/zoneLabels.i18n.json';
import incomingRevealTitles from './IncomingRevealDialog.i18n.json';
import { incomingRevealTitle } from './IncomingRevealDialog';

vi.mock('../../../../hooks/useSettings');

vi.mock('../../../../services/cards/catalog/lookup', () => {
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

const REVEALED = [makeCard({ id: 0, name: 'Island', pt: '1/2' }), makeCard({ id: 1, name: 'Forest', pt: '3/4' })];

function renderReveal({
  grantWriteAccess = false,
  readOnly = false,
  zoneName = ZoneName.DECK as string,
  snapshot = REVEALED as typeof REVEALED | null,
} = {}) {
  const preloadedState = buildSeatGameState({
    localPlayerId: 1,
    seats: [
      { playerId: 1, deckCount: 40 },
      { playerId: 2, deckCount: 30, handCount: 7 },
    ],
  });
  preloadedState.games = {
    ...preloadedState.games!,
    incomingReveal: { gameId: 1, sourceOwnerId: 2, zoneName, cards: REVEALED, grantWriteAccess },
  } as typeof preloadedState.games;
  preloadedState.games!.games![1]!.players![2]!.zones![zoneName]!.revealedCards = snapshot ?? undefined;
  const webClient = createMockWebClient();
  const utils = renderWithProviders(
    <ShortcutProvider><GameReadOnlyProvider value={readOnly}><Game /></GameReadOnlyProvider></ShortcutProvider>,
    { preloadedState, webClient, route: '/game/1' },
  );
  const reveal = () => utils.store.getState().games;
  return { ...utils, reveal, game: webClient.request.game };
}

const TITLE = /reveals their/;

function popup() {
  return screen.getByRole('heading', { name: TITLE }).closest<HTMLElement>('.pointer-events-auto')!;
}

function selectionCount(): string | null {
  const status = screen.getAllByRole('status').find((el) => el.textContent === 'TallyOverlay.selectedCount');
  return status?.nextElementSibling?.querySelector('[aria-hidden="true"]')?.textContent ?? null;
}

describe('IncomingRevealDialog', () => {
  it.each([false, true])('shows a replay reveal with write access=%s but sends no commands', async (grantWriteAccess) => {
    const { game } = renderReveal({ readOnly: true, grantWriteAccess });
    const panel = screen.getByRole('dialog', { name: TITLE });
    const island = within(panel).getByRole('button', { name: 'Island' });
    expect(within(panel).queryByRole('button', { name: /Move .* to a battlefield/ })).not.toBeInTheDocument();
    fireEvent.pointerDown(island, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 200, clientY: 200 });
    fireEvent.pointerUp(window);
    for (const key of ['Enter', ' ', 'm']) {
      fireEvent.keyDown(island, { key });
    }
    fireEvent.doubleClick(island);
    fireEvent.keyDown(island, { key: 'Enter', code: 'Enter', ctrlKey: true });
    fireEvent.keyDown(island, { key: ' ', code: 'Space', ctrlKey: true });
    fireEvent.contextMenu(island);
    const clone = screen.getByRole('menuitem', { name: /^Clone/ });
    expect(clone).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(clone);
    chooseMenuPath('Hide');
    fireEvent.click(within(panel).getAllByRole('button', { name: 'Common.action.close' })[0]);
    await act(async () => {});

    for (const send of Object.values(game)) {
      expect(send).not.toHaveBeenCalled();
    }
  });

  it('names the sender and the zone and shows every revealed card', () => {
    renderReveal();

    expect(screen.getByRole('heading', { name: 'P2 reveals their library' })).toBeInTheDocument();
    expect(within(popup()).getByText(/^2 cards/)).toBeInTheDocument();
    expect(within(popup()).getByTitle('Island')).toBeInTheDocument();
    expect(within(popup()).getByTitle('Forest')).toBeInTheDocument();
  });

  it.each(['hide', 'close', 'source cleared'])('feeds reveal selection into the count and clears it on %s', async (action) => {
    const { store } = renderReveal();
    fireEvent.click(within(popup()).getByRole('button', { name: 'Island' }));
    fireEvent.click(within(popup()).getByRole('button', { name: 'Forest' }), { ctrlKey: true });
    expect(selectionCount()).toBe('2');
    if (action === 'hide') {
      fireEvent.contextMenu(within(popup()).getByTitle('Forest'));
      chooseMenuPath('Hide');
    } else if (action === 'close') {
      fireEvent.click(within(popup()).getAllByRole('button', { name: 'Common.action.close' })[0]);
    } else {
      act(() => store.dispatch(games.Actions.zoneViewCleared({ gameId: 1, playerId: 2, zoneName: ZoneName.DECK })));
    }
    await act(async () => {});
    expect(selectionCount()).toBeNull();
  });

  it('tallies revealed live P/T and removes the selection when a new reveal replaces it', async () => {
    const { result } = renderHook(() => useTallyType());
    const { store } = renderReveal();
    try {
      act(() => result.current[1]('power'));
      fireEvent.click(within(popup()).getByRole('button', { name: 'Island' }));
      fireEvent.click(within(popup()).getByRole('button', { name: 'Forest' }), { ctrlKey: true });
      await act(async () => {});
      expect(within(screen.getByRole('status', { name: 'Tally' })).getByText('4')).toBeInTheDocument();
      act(() => store.dispatch(games.Actions.incomingRevealShown({
        gameId: 1, sourceOwnerId: 2, zoneName: ZoneName.DECK, cards: REVEALED, grantWriteAccess: false,
      })));
      expect(screen.queryByRole('status', { name: 'Tally' })).not.toBeInTheDocument();
      expect(selectionCount()).toBeNull();
    } finally {
      act(() => result.current[1]('none'));
    }
  });

  it('says when the sender lent the zone', () => {
    renderReveal({ grantWriteAccess: true });
    expect(within(popup()).getByText(/write access granted/)).toBeInTheDocument();
  });

  it('dismisses the reveal and clears the sender’s snapshot on close', () => {
    const { reveal } = renderReveal();

    fireEvent.click(within(popup()).getAllByRole('button', { name: 'Common.action.close' })[0]);

    expect(reveal().incomingReveal).toBeNull();
    expect(reveal().games[1].players[2].zones[ZoneName.DECK].revealedCards ?? []).toEqual([]);
    expect(screen.queryByRole('heading', { name: TITLE })).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const { reveal } = renderReveal({ zoneName: ZoneName.HAND });
    expect(screen.getByRole('heading', { name: 'P2 reveals their hand' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(reveal().incomingReveal).toBeNull();
  });

  describe('read-only reveal card menu', () => {
    function rightClick(name: string) {
      act(() => {
        fireEvent.contextMenu(within(popup()).getByTitle(name));
      });
    }

    it('Hide removes the card from this window only and sends nothing', () => {
      const { reveal, game } = renderReveal();
      rightClick('Island');
      chooseMenuPath('Hide');

      expect(within(popup()).queryByTitle('Island')).not.toBeInTheDocument();
      expect(within(popup()).getByTitle('Forest')).toBeInTheDocument();
      expect(openMenus()).toHaveLength(0);
      expect(reveal().games[1].players[2].zones[ZoneName.DECK].revealedCards).toEqual(REVEALED);
      for (const send of Object.values(game)) {
        expect(send).not.toHaveBeenCalled();
      }
    });

    it('Select All then Alt+H hides every card and keeps the window open', () => {
      renderReveal();
      rightClick('Forest');
      chooseMenuPath('Select All');
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', altKey: true, bubbles: true, cancelable: true }));
      });

      expect(within(popup()).queryByTitle('Island')).not.toBeInTheDocument();
      expect(within(popup()).queryByTitle('Forest')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();
    });

    it.each([
      { key: 'Enter', code: 'Enter', ctrlKey: true, action: 'turn' },
      { key: ' ', code: 'Space', ctrlKey: true, action: 'phase' },
      { key: 'Enter', code: 'Enter', shiftKey: true, action: 'chat' },
    ])('passes $action chords through without selecting the tile', ({ action, ...chord }) => {
      const { game } = renderReveal();
      const island = within(popup()).getByRole('button', { name: 'Island' });
      island.focus();

      fireEvent.keyDown(island, chord);

      if (action === 'turn') {
        expect(game.nextTurn).toHaveBeenCalledWith(1);
      } else if (action === 'phase') {
        expect(game.setActivePhase).toHaveBeenCalled();
      } else {
        expect(screen.getByRole('combobox', { name: 'ChatLog.inputLabel' })).toHaveFocus();
      }
      expect(island).toHaveAttribute('aria-pressed', 'false');
    });

    it.each(['ctrlKey', 'altKey', 'metaKey', 'shiftKey'])('does not select tiles with %s held', (modifier) => {
      renderReveal();
      const island = within(popup()).getByRole('button', { name: 'Island' });
      for (const key of ['Enter', ' ']) {
        fireEvent.keyDown(island, { key, [modifier]: true });
        expect(island).toHaveAttribute('aria-pressed', 'false');
      }
    });

    it('selects cards from the keyboard, so Alt+H can hide them', () => {
      renderReveal();
      const island = within(popup()).getByRole('button', { name: 'Island' });
      expect(island).toHaveAttribute('tabindex', '0');
      expect(island).toHaveAttribute('aria-pressed', 'false');

      fireEvent.keyDown(island, { key: ' ' });
      expect(island).toHaveAttribute('aria-pressed', 'true');
      fireEvent.keyDown(island, { key: ' ' });
      expect(island).toHaveAttribute('aria-pressed', 'false');
      fireEvent.keyDown(island, { key: 'Enter' });
      expect(island).toHaveAttribute('aria-pressed', 'true');
      fireEvent.keyDown(within(popup()).getByRole('button', { name: 'Forest' }), { key: 'Enter' });
      fireEvent.keyDown(island, { key: 'Enter' });
      expect(island).toHaveAttribute('aria-pressed', 'false');

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', altKey: true, bubbles: true, cancelable: true }));
      });
      expect(within(popup()).getByTitle('Island')).toBeInTheDocument();
      expect(within(popup()).queryByTitle('Forest')).not.toBeInTheDocument();
    });

    it('a new reveal shows its cards again', () => {
      const { store } = renderReveal();
      rightClick('Island');
      chooseMenuPath('Hide');

      act(() => {
        store.dispatch(games.Actions.incomingRevealShown({
          gameId: 1,
          sourceOwnerId: 2,
          zoneName: ZoneName.DECK,
          cards: REVEALED,
          grantWriteAccess: false,
        }));
      });

      expect(within(popup()).getByTitle('Island')).toBeInTheDocument();
    });

    it('a lent reveal has no card menu', () => {
      renderReveal({ grantWriteAccess: true });
      rightClick('Island');
      expect(openMenus()).toHaveLength(0);
    });
  });

  it('lists the sender’s live snapshot rather than the first payload', () => {
    renderReveal({ snapshot: [REVEALED[0]] });
    expect(within(popup()).getByTitle('Island')).toBeInTheDocument();
    expect(within(popup()).queryByTitle('Forest')).not.toBeInTheDocument();
  });

  it('shows no cards when the snapshot was emptied or never seeded', () => {
    const { unmount } = renderReveal({ snapshot: [] });
    expect(within(popup()).getByText('No cards to show.')).toBeInTheDocument();
    unmount();

    renderReveal({ snapshot: null });
    expect(within(popup()).getByText('No cards to show.')).toBeInTheDocument();
  });

  it('says it is loading until the catalog answers, then groups by type', async () => {
    renderReveal();
    expect(within(popup()).getAllByText('Loading card details…')).not.toHaveLength(0);
    expect(await within(popup()).findByText('Other')).toBeInTheDocument();
    expect(within(popup()).queryAllByText('Loading card details…')).toHaveLength(0);
  });

  describe('its own stored choices', () => {
    afterEach(() => {
      window.localStorage.clear();
    });

    it('restores and stores the group, sort and pile choices under their own keys', async () => {
      window.localStorage.setItem('webatrice.incomingRevealGroupBy', 'none');
      window.localStorage.setItem('webatrice.searchLibraryGroupBy', 'cmc');
      renderReveal();
      await within(popup()).findAllByTitle('Island');
      expect(within(popup()).getByTitle('Group by')).toHaveValue('none');
      expect(within(popup()).getByRole('checkbox', { name: /pile view/ })).toBeDisabled();

      fireEvent.change(within(popup()).getByTitle('Sort by'), { target: { value: 'set' } });
      expect(window.localStorage.getItem('webatrice.incomingRevealSortBy')).toBe('set');
      expect(window.localStorage.getItem('webatrice.searchLibrarySortBy')).toBeNull();
    });

    it('opens at 900×520 unless a size is stored', () => {
      const { unmount } = renderReveal();
      expect(popup().style.width).toBe('900px');
      expect(popup().style.height).toBe('520px');
      unmount();

      window.localStorage.setItem('webatrice.incomingRevealSize', JSON.stringify({ w: 640, h: 480 }));
      renderReveal();
      expect(popup().style.width).toBe('640px');
      expect(popup().style.height).toBe('480px');
    });

    it('restores a stored size, clamped between its minimum and the viewport', () => {
      window.localStorage.setItem('webatrice.incomingRevealSize', JSON.stringify({ w: 5000, h: 100 }));
      renderReveal();
      expect(popup().style.width).toBe(`${window.innerWidth}px`);
      expect(popup().style.height).toBe('300px');
    });

    it('opens again, at its opening size and centred, when another reveal arrives', () => {
      vi.useFakeTimers();
      try {
        const { store } = renderReveal();
        popup().style.width = '640px';
        const header = screen.getByRole('heading', { name: TITLE }).parentElement!;
        popup().getBoundingClientRect = () => new DOMRect(100, 100, 400, 300);
        fireEvent.pointerDown(header, { button: 0, clientX: 110, clientY: 105 });
        act(() => {
          window.dispatchEvent(new MouseEvent('pointermove', { clientX: 210, clientY: 155 }));
        });
        act(() => {
          window.dispatchEvent(new MouseEvent('pointerup'));
        });
        expect(popup().style.left).toBe('200px');

        const hand = [makeCard({ id: 0, name: 'Swamp' })];
        act(() => {
          store.dispatch(games.Actions.zoneViewRevealed({
            gameId: 1, playerId: 2, zoneName: ZoneName.HAND, cards: hand, isReversed: false,
          }));
          store.dispatch(games.Actions.incomingRevealShown({
            gameId: 1, sourceOwnerId: 2, zoneName: ZoneName.HAND, cards: hand, grantWriteAccess: false,
          }));
        });

        expect(screen.getByRole('heading', { name: 'P2 reveals their hand' })).toBeInTheDocument();
        expect(popup().style.width).toBe('900px');
        expect(popup().style.left).toBe('312px');
        expect(popup().style.top).toBe('234px');
        act(() => {
          vi.advanceTimersByTime(1000);
        });
        expect(window.localStorage.getItem('webatrice.incomingRevealPosition')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('restores a stored position, keeping 60px of its header on screen', () => {
      window.localStorage.setItem('webatrice.incomingRevealPosition', JSON.stringify({ x: 5000, y: -40 }));
      renderReveal();
      expect(popup().style.left).toBe(`${window.innerWidth - 60}px`);
      expect(popup().style.top).toBe('0px');
    });
  });
});

describe('incomingRevealTitle', () => {
  const englishT = catalogT(zoneLabels, incomingRevealTitles);

  it('names the sender and the zone, in lower case', () => {
    expect(incomingRevealTitle(englishT, 'P2', ZoneName.DECK)).toBe('P2 reveals their library');
    expect(incomingRevealTitle(englishT, 'P2', ZoneName.HAND)).toBe('P2 reveals their hand');
    expect(incomingRevealTitle(englishT, 'P2', ZoneName.EXILE)).toBe('P2 reveals their exile');
    expect(incomingRevealTitle(englishT, undefined, ZoneName.GRAVE)).toBe('A player reveals their graveyard');
  });

  it('translates the title as one message, so a language can reorder it', () => {
    const germanT = catalogT({
      ZoneLabel: { inline: { deck: 'Bibliothek' } },
      IncomingRevealDialog: { title: '{player} zeigt die {zone}', titleUnknownSender: 'Jemand zeigt die {zone}' },
    });
    expect(incomingRevealTitle(germanT, 'P2', ZoneName.DECK)).toBe('P2 zeigt die Bibliothek');
    expect(incomingRevealTitle(germanT, undefined, ZoneName.DECK)).toBe('Jemand zeigt die Bibliothek');
  });
});

describe('a lent zone from the keyboard', () => {
  it('is a non-modal dialog named by its title, where Tab moves focus', () => {
    const { game } = renderReveal({ grantWriteAccess: true });
    const panel = screen.getByRole('dialog', { name: TITLE });
    const island = within(panel).getByRole('button', { name: 'Move Island to a battlefield' });
    const tab = fireEvent.keyDown(island.closest('.overflow-auto')!, { key: 'Tab', code: 'Tab' });
    expect(tab).toBe(true);
    expect(game.setActivePhase).not.toHaveBeenCalled();
  });

  it('moves a lent card onto the borrower\'s battlefield through the keyboard move, as its drag does', () => {
    const { game } = renderReveal({ grantWriteAccess: true });
    const island = screen.getByRole('button', { name: 'Move Island to a battlefield' });
    act(() => island.focus());
    act(() => {
      fireEvent.keyDown(island, { key: 'Enter' });
    });
    const dialog = screen.getByRole('dialog', { name: 'Move Island' });
    const to = within(dialog).getByLabelText('To') as HTMLSelectElement;
    expect([...to.options].map((o) => o.value)).toEqual(['battlefield:1']);
    act(() => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Move' }));
    });
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      startPlayerId: 2, startZone: ZoneName.DECK, cardsToMove: { card: [{ cardId: 0 }] },
      targetPlayerId: 1, targetZone: ZoneName.TABLE,
    });
  });
});
