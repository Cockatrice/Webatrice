
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { renderWithProviders } from '../../../../__test-utils__';
import { lookupCardsCached } from '../../../../services/cards/catalog/lookup';
import { getSettings, settingsStore } from '../../../../hooks/useSettings';
import ZoneViewPanel from './ZoneViewPanel';

vi.mock('../../../../services/cards/catalog/lookup', () => ({
  lookupCardsCached: vi.fn(),
}));

type LookupResult = Awaited<ReturnType<typeof lookupCardsCached>> extends Map<string, infer R> ? R : never;

const CATALOG: Record<string, Partial<LookupResult>> = {
  'Grizzly Bears': { typeLine: 'Creature — Bear', cmc: 2, colors: ['G'], power: '2', toughness: '2' },
  Forest: { typeLine: 'Basic Land — Forest', cmc: 0, colors: [] },
  Shock: { typeLine: 'Instant', cmc: 1, colors: ['R'] },
};

function catalogResult(name: string): LookupResult {
  const known = CATALOG[name];
  return (known
    ? { found: true, source: 'scryfall', name, printings: [{ set: 'm10' }], ...known }
    : { found: false, source: 'unknown', name, printings: [] }) as unknown as LookupResult;
}

function mockCatalog({ deferred = false } = {}) {
  let release = () => undefined as void;
  vi.mocked(lookupCardsCached).mockImplementation(async (names: string[]) => {
    if (deferred) {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    return new Map(names.map((n) => [n, catalogResult(n)]));
  });
  return { release: () => act(async () => release()) };
}

const BEARS = { id: '1', name: 'Grizzly Bears', scryfallId: '' };
const FOREST = { id: '2', name: 'Forest', scryfallId: '' };
const SHOCK = { id: '3', name: 'Shock', scryfallId: '' };
const CARDS = [SHOCK, FOREST, BEARS];

function Harness(props: Partial<React.ComponentProps<typeof ZoneViewPanel>>) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  return (
    <ZoneViewPanel
      title="Zone"
      library={CARDS}
      onClose={() => undefined}
      selectedIds={selectedIds}
      onSelectedIdsChange={setSelectedIds}
      {...props}
    />
  );
}

async function renderPanel(props: Partial<React.ComponentProps<typeof ZoneViewPanel>> = {}) {
  const result = renderWithProviders(<Harness {...props} />);
  await act(async () => undefined);
  return result;
}

const dialog = () => screen.getByRole('heading', { name: /^Zone/ }).closest<HTMLElement>('.pointer-events-auto.resize')!;
const cardIds = () => Array.from(dialog().querySelectorAll<HTMLElement>('[data-card][data-card-id]')).map((el) => el.dataset.cardId);
const groupLabels = () => Array.from(dialog().querySelectorAll('.uppercase')).map((el) => el.firstChild?.textContent?.trim());
const groupSelect = () => screen.getByTitle('Group by') as HTMLSelectElement;
const sortSelect = () => screen.getByTitle('Sort by') as HTMLSelectElement;
const pileBox = () => screen.getByRole('checkbox', { name: /pile view/ }) as HTMLInputElement;

beforeEach(() => {
  mockCatalog();
});

afterEach(() => {
  window.localStorage.clear();
  settingsStore.reset();
});

describe('ZoneViewPanel', () => {
  describe('floating geometry', () => {
    it('centres itself when no position is stored', async () => {
      await renderPanel();
      expect(dialog().style.left).toBe('512px');
      expect(dialog().style.top).toBe('384px');
    });

    it('restores a stored position, keeping 60px of its header on screen', async () => {
      window.localStorage.setItem('webatrice.searchLibraryPosition', JSON.stringify({ x: 5000, y: -40 }));
      await renderPanel();
      expect(dialog().style.left).toBe(`${window.innerWidth - 60}px`);
      expect(dialog().style.top).toBe('0px');
    });

    it('ignores a malformed stored position', async () => {
      window.localStorage.setItem('webatrice.searchLibraryPosition', '{"x":"left"}');
      await renderPanel();
      expect(dialog().style.left).toBe('512px');
    });

    it('restores a stored size, clamped between its minimum and the viewport', async () => {
      window.localStorage.setItem('webatrice.searchLibrarySize', JSON.stringify({ w: 5000, h: 100 }));
      await renderPanel();
      expect(dialog().style.width).toBe(`${window.innerWidth}px`);
      expect(dialog().style.height).toBe('300px');
    });

    it('fits a viewport smaller than its minimum, the viewport winning', async () => {
      const { innerWidth } = window;
      window.innerWidth = 300;
      try {
        window.localStorage.setItem('webatrice.searchLibrarySize', JSON.stringify({ w: 100, h: 400 }));
        await renderPanel();
        expect(dialog().style.width).toBe('300px');
        expect(dialog().style.minWidth).toBe('min(400px, 100vw)');
      } finally {
        window.innerWidth = innerWidth;
      }
    });

    it('stores where the header drags it to, half a second after the drag', async () => {
      vi.useFakeTimers();
      try {
        renderWithProviders(<Harness />);
        const header = screen.getByRole('heading', { name: /^Zone/ }).parentElement!;
        dialog().getBoundingClientRect = () => new DOMRect(100, 100, 400, 300);
        fireEvent.pointerDown(header, { button: 0, clientX: 110, clientY: 105 });
        act(() => {
          window.dispatchEvent(new MouseEvent('pointermove', { clientX: 210, clientY: 155 }));
        });
        act(() => {
          window.dispatchEvent(new MouseEvent('pointerup'));
        });
        expect(dialog().style.left).toBe('200px');
        expect(dialog().style.top).toBe('150px');
        expect(window.localStorage.getItem('webatrice.searchLibraryPosition')).toBeNull();
        act(() => {
          vi.advanceTimersByTime(500);
        });
        expect(JSON.parse(window.localStorage.getItem('webatrice.searchLibraryPosition')!)).toEqual({ x: 200, y: 150 });
      } finally {
        vi.useRealTimers();
      }
    });

    it('stores a size the user resizes it to, not the one it opens at', async () => {
      let resized: (w: number, h: number) => void = () => undefined;
      vi.stubGlobal('ResizeObserver', class {
        constructor(callback: ResizeObserverCallback) {
          resized = (w, h) => callback(
            [{ contentRect: new DOMRect(0, 0, w, h) } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      });
      vi.useFakeTimers();
      try {
        renderWithProviders(<Harness />);
        act(() => {
          resized(900, 480);
          vi.advanceTimersByTime(1000);
        });
        expect(window.localStorage.getItem('webatrice.searchLibrarySize')).toBeNull();
        act(() => {
          resized(640, 420);
          vi.advanceTimersByTime(500);
        });
        expect(JSON.parse(window.localStorage.getItem('webatrice.searchLibrarySize')!)).toEqual({ w: 640, h: 420 });
      } finally {
        vi.useRealTimers();
        vi.unstubAllGlobals();
      }
    });

    it('does not start a drag from a header button', async () => {
      await renderPanel();
      dialog().getBoundingClientRect = () => new DOMRect(100, 100, 400, 300);
      fireEvent.pointerDown(screen.getByTitle('ZoneViewPanel.close'), { button: 0, clientX: 110, clientY: 105 });
      expect(dialog().closest('.cursor-grabbing')).toBeNull();
      expect(dialog().querySelector('.cursor-grabbing')).toBeNull();
    });
  });

  describe('view preferences', () => {
    it('groups by type, sorts by name and piles by default, as desktop does', async () => {
      await renderPanel();
      expect(groupSelect().value).toBe('type');
      expect(sortSelect().value).toBe('name');
      expect(pileBox()).toBeChecked();
      expect(groupLabels()).toEqual(['Creature', 'Instant', 'Land']);
    });

    it('restores the stored choices and ignores unknown ones', async () => {
      window.localStorage.setItem('webatrice.searchLibraryGroupBy', 'cmc');
      window.localStorage.setItem('webatrice.searchLibrarySortBy', 'bogus');
      window.localStorage.setItem('webatrice.searchLibraryPileView', '0');
      await renderPanel();
      expect(groupSelect().value).toBe('cmc');
      expect(sortSelect().value).toBe('name');
      expect(pileBox()).not.toBeChecked();
    });

    it('stores each choice when it changes', async () => {
      await renderPanel();
      fireEvent.change(groupSelect(), { target: { value: 'color' } });
      fireEvent.change(sortSelect(), { target: { value: 'pt' } });
      fireEvent.click(pileBox());
      expect(window.localStorage.getItem('webatrice.searchLibraryGroupBy')).toBe('color');
      expect(window.localStorage.getItem('webatrice.searchLibrarySortBy')).toBe('pt');
      expect(window.localStorage.getItem('webatrice.searchLibraryPileView')).toBe('0');
    });

    it('disables pile view while ungrouped', async () => {
      await renderPanel();
      fireEvent.change(groupSelect(), { target: { value: 'none' } });
      expect(pileBox()).toBeDisabled();
      expect(pileBox()).not.toBeChecked();
      expect(groupLabels()).toEqual([]);
    });

    it('sorts within each group', async () => {
      await renderPanel();
      fireEvent.change(groupSelect(), { target: { value: 'none' } });
      expect(cardIds()).toEqual(['2', '1', '3']);
      fireEvent.change(sortSelect(), { target: { value: 'cmc' } });
      expect(cardIds()).toEqual(['2', '3', '1']);
      fireEvent.change(sortSelect(), { target: { value: 'none' } });
      expect(cardIds()).toEqual(['3', '2', '1']);
    });
  });

  describe('catalog metadata', () => {
    it('lists the cards ungrouped and unsorted until every name is known', async () => {
      const catalog = mockCatalog({ deferred: true });
      renderWithProviders(<Harness />);
      expect(groupLabels()).toEqual([]);
      expect(cardIds()).toEqual(['3', '2', '1']);

      await catalog.release();
      expect(groupLabels()).toEqual(['Creature', 'Instant', 'Land']);
    });

    it('looks each name up once', async () => {
      const { rerender } = await renderPanel();
      expect(lookupCardsCached).toHaveBeenCalledTimes(1);
      expect(vi.mocked(lookupCardsCached).mock.calls[0][0].sort()).toEqual(['Forest', 'Grizzly Bears', 'Shock']);

      rerender(<Harness library={[...CARDS, { id: '4', name: 'Forest', scryfallId: '' }, { id: '5', name: 'Opt', scryfallId: '' }]} />);
      await act(async () => undefined);
      expect(lookupCardsCached).toHaveBeenCalledTimes(2);
      expect(vi.mocked(lookupCardsCached).mock.calls[1][0]).toEqual(['Opt']);
    });

    it('groups a card the catalog does not know under Other', async () => {
      await renderPanel({ library: [BEARS, { id: '9', name: 'Mystery', scryfallId: '' }] });
      expect(groupLabels()).toEqual(['Creature', 'Other']);
    });
  });

  describe('search', () => {
    it('filters on the search syntax and counts what it shows', async () => {
      await renderPanel();
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 't:creature' } });
      expect(cardIds()).toEqual(['1']);
      expect(screen.getByRole('heading', { name: /^Zone/ })).toHaveTextContent('1 / 3');

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'nothing-matches' } });
      expect(screen.getByText('ZoneViewPanel.noMatch')).toBeInTheDocument();
    });
  });

  describe('card layouts', () => {
    it('fans each group into a pile, or wraps it into a grid', async () => {
      await renderPanel();
      const cell = () => dialog().querySelector<HTMLElement>('[data-card-id="1"]')!;
      expect(cell()).toHaveClass('absolute');
      expect(cell().firstElementChild).toHaveClass('pointer-events-none');

      fireEvent.click(pileBox());
      expect(cell()).toHaveClass('shrink-0');
      expect(cell()).not.toHaveClass('absolute');
    });

    it('lays an ungrouped view out as a grid, pile view on or not, as desktop does', async () => {
      window.localStorage.setItem('webatrice.searchLibraryGroupBy', 'none');
      window.localStorage.setItem('webatrice.searchLibraryPileView', '1');
      await renderPanel();
      expect(pileBox()).toBeDisabled();
      for (const id of ['1', '2', '3']) {
        const cell = dialog().querySelector<HTMLElement>(`[data-card-id="${id}"]`)!;
        expect(cell).toHaveClass('shrink-0');
        expect(cell).not.toHaveClass('absolute');
        expect(cell.parentElement).toHaveClass('flex-wrap');
      }

      fireEvent.change(groupSelect(), { target: { value: 'type' } });
      expect(dialog().querySelector<HTMLElement>('[data-card-id="1"]')).toHaveClass('absolute');
    });

    it('hides the cards being dragged and rings the selected ones', async () => {
      await renderPanel({ draggingCardIds: new Set(['2']), selectedIds: new Set(['3']), onSelectedIdsChange: () => undefined });
      expect(dialog().querySelector<HTMLElement>('[data-card-id="2"]')!.style.opacity).toBe('0');
      expect(dialog().querySelector<HTMLElement>('[data-card-id="3"]')!.style.boxShadow).not.toBe('');
      expect(dialog().querySelector<HTMLElement>('[data-card-id="1"]')!.style.boxShadow).toBe('');
    });

    it('hands a left press on a card to the caller, and makes the cards grabbable', async () => {
      const onCardPointerDown = vi.fn();
      await renderPanel({ onCardPointerDown });
      const cell = dialog().querySelector<HTMLElement>('[data-card-id="1"]')!;
      expect(cell.style.cursor).toBe('grab');
      fireEvent.pointerDown(cell, { button: 2 });
      expect(onCardPointerDown).not.toHaveBeenCalled();
      fireEvent.pointerDown(cell, { button: 0 });
      expect(onCardPointerDown).toHaveBeenCalledWith(expect.anything(), BEARS);
    });

    it('gives a right-clicked card its view and column', async () => {
      const onCardContextMenu = vi.fn();
      await renderPanel({ onCardContextMenu });
      fireEvent.contextMenu(dialog().querySelector<HTMLElement>('[data-card-id="2"]')!);
      expect(onCardContextMenu).toHaveBeenCalledWith(expect.anything(), FOREST, { shownIds: ['1', '3', '2'], columnIds: ['2'] });
    });
  });

  describe('marquee', () => {
    function layOut() {
      const content = dialog().querySelector<HTMLElement>('.overflow-auto')!;
      content.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 800);
      dialog().getBoundingClientRect = () => new DOMRect(0, 0, 1000, 900);
      const place = (id: string, left: number) => {
        dialog().querySelector<HTMLElement>(`[data-card-id="${id}"]`)!.getBoundingClientRect = () => new DOMRect(left, 100, 100, 140);
      };
      place('1', 10);
      place('3', 200);
      place('2', 400);
      return content;
    }

    it('selects the cards the band touches, live, and clears on a fresh press', async () => {
      await renderPanel();
      const content = layOut();

      fireEvent.pointerDown(content, { button: 0, clientX: 0, clientY: 0 });
      expect(document.body.style.userSelect).toBe('none');
      act(() => {
        window.dispatchEvent(new MouseEvent('pointermove', { clientX: 250, clientY: 150 }));
      });
      expect(dialog().querySelector<HTMLElement>('[data-card-id="1"]')!.style.boxShadow).not.toBe('');
      expect(dialog().querySelector<HTMLElement>('[data-card-id="3"]')!.style.boxShadow).not.toBe('');
      expect(dialog().querySelector<HTMLElement>('[data-card-id="2"]')!.style.boxShadow).toBe('');
      expect(document.body.querySelector('.fixed.pointer-events-none[style*="z-index: 1001"]')).not.toBeNull();

      act(() => {
        window.dispatchEvent(new MouseEvent('pointerup'));
      });
      expect(document.body.style.userSelect).toBe('');
      expect(dialog().querySelector<HTMLElement>('[data-card-id="1"]')!.style.boxShadow).not.toBe('');

      fireEvent.pointerDown(content, { button: 0, clientX: 900, clientY: 700 });
      expect(dialog().querySelector<HTMLElement>('[data-card-id="1"]')!.style.boxShadow).toBe('');
    });

    it('starts no band from a card, a control or the resize handle', async () => {
      const onSelectedIdsChange = vi.fn();
      await renderPanel({ selectedIds: new Set(), onSelectedIdsChange });
      layOut();
      fireEvent.pointerDown(dialog().querySelector<HTMLElement>('[data-card-id="1"]')!, { button: 0 });
      fireEvent.pointerDown(groupSelect(), { button: 0 });
      fireEvent.pointerDown(dialog().querySelector<HTMLElement>('.overflow-auto')!, { button: 0, clientX: 990, clientY: 890 });
      fireEvent.pointerDown(dialog().querySelector<HTMLElement>('.overflow-auto')!, { button: 2, clientX: 5, clientY: 5 });
      expect(onSelectedIdsChange).not.toHaveBeenCalled();
    });
  });

  it('passes its shuffle choice to the close, and only for a library', async () => {
    const onClose = vi.fn();
    const first = await renderPanel({ onClose });
    fireEvent.click(screen.getByRole('checkbox', { name: 'ZoneViewPanel.shuffleOnClose' }));
    fireEvent.click(screen.getByTitle('ZoneViewPanel.close'));
    expect(onClose).toHaveBeenLastCalledWith(false);
    expect(window.localStorage.getItem('webatrice.searchLibraryShuffleOnClose')).toBe('0');
    first.unmount();

    await renderPanel({ onClose, showShuffleOnClose: false });
    expect(screen.queryByRole('checkbox', { name: 'ZoneViewPanel.shuffleOnClose' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('ZoneViewPanel.close'));
    expect(onClose).toHaveBeenLastCalledWith(false);
  });

  describe('as a non-modal dialog', () => {
    function Opener({ onClose }: { onClose: (shuffle: boolean) => void }) {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open</button>
          {open && (
            <Harness
              onClose={(shuffle) => {
                onClose(shuffle);
                setOpen(false);
              }}
            />
          )}
        </>
      );
    }

    afterEach(() => {
      settingsStore.reset();
    });

    it('is named by its title, and names its search box and close button', async () => {
      await renderPanel();
      const view = screen.getByRole('dialog', { name: 'Zone' });
      expect(view).not.toHaveAttribute('aria-modal');
      expect(within(view).getByRole('textbox', { name: 'ZoneViewPanel.search' })).toBeInTheDocument();
      expect(within(view).getByRole('button', { name: 'ZoneViewPanel.close' })).toHaveClass('focus-visible:ring-2');
      expect(within(view).getByRole('textbox', { name: 'ZoneViewPanel.search' })).toHaveClass('focus-visible:ring-2');
    });

    it('takes focus on open and gives it back to the opener when Escape closes it', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderWithProviders(<Opener onClose={onClose} />);
      await user.click(screen.getByRole('button', { name: 'Open' }));
      await act(async () => undefined);
      expect(screen.getByRole('textbox', { name: 'ZoneViewPanel.search' })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('dialog', { name: 'Zone' })).toContainElement(document.activeElement as HTMLElement);
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledWith(true);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
    });

    it('puts focus on its title when the search box is not to take it', async () => {
      const user = userEvent.setup();
      const settings = await getSettings();
      settingsStore.setValue(Object.assign(settings, { focusCardViewSearchBar: false }));
      renderWithProviders(<Opener onClose={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: 'Open' }));
      await act(async () => undefined);
      expect(screen.getByRole('heading', { name: /^Zone/ })).toHaveFocus();
    });

    it('leaves focus where it was while "Keep game chat focused" is on', async () => {
      const user = userEvent.setup();
      const settings = await getSettings();
      settingsStore.setValue(Object.assign(settings, { keepGameChatFocus: true }));
      renderWithProviders(<Opener onClose={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: 'Open' }));
      await act(async () => undefined);
      expect(screen.getByRole('dialog', { name: 'Zone' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
    });
  });

  it('stops pointer presses at the portal so the seat behind starts no marquee', async () => {
    const onPointerDown = vi.fn();
    renderWithProviders(
      <div onPointerDown={onPointerDown}>
        <Harness />
      </div>,
    );
    await act(async () => undefined);
    fireEvent.pointerDown(within(dialog()).getByRole('textbox'));
    expect(onPointerDown).not.toHaveBeenCalled();
  });
});
