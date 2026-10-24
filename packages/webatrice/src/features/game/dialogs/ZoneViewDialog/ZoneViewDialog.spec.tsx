import { ZoneName } from '@cockatrice/sockatrice';
import { act, fireEvent, screen, within } from '@testing-library/react';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';
import type { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { ServerInfo_Zone_ZoneType } from '@cockatrice/sockatrice/generated';

import { makeStoreState, makeUser, renderWithProviders } from '../../../../__test-utils__';
import { getSettings, settingsStore } from '../../../../hooks/useSettings';
import { GameSelectionProvider } from '../../components/ui/GameSelectionContext';
import type { ZoneViewTarget } from '../../hooks/dialogs/gameDialogs.types';
import ZoneViewDialog from './ZoneViewDialog';

vi.mock('../../../../services/cards/catalog/lookup', () => ({
  lookupCardsCached: vi.fn(async (names: string[]) =>
    new Map(names.map((name) => [name, { found: false, source: 'unknown', name, printings: [] }]))),
}));

const OPT = makeCard({ id: 7, name: 'Opt' });
const DURESS = makeCard({ id: 8, name: 'Duress' });

type ZoneSpec = {
  name: NonNullable<Parameters<typeof makeZoneEntry>[0]['name']>;
  cards?: ServerInfo_Card[];
  cardCount: number;
  revealedCards?: ServerInfo_Card[];
};

function stateWith(zone: ZoneSpec) {
  const seat = (playerId: number, name: string) => {
    const entry = makeZoneEntry({
      name: zone.name, cards: zone.cards ?? [], cardCount: zone.cardCount,
      type: zone.name === ZoneName.DECK || zone.name === ZoneName.SIDEBOARD
        ? ServerInfo_Zone_ZoneType.HiddenZone : ServerInfo_Zone_ZoneType.PublicZone,
    });
    entry.revealedCards = zone.revealedCards;
    return makePlayerEntry({
      properties: makePlayerProperties({ playerId, userInfo: makeUser({ name }) }),
      zones: { [zone.name]: entry },
    });
  };
  return makeStoreState({
    games: {
      games: {
        1: makeGameEntry({ localPlayerId: 1, players: { 1: seat(1, 'Trajer'), 2: seat(2, 'Opp') } }),
      },
    },
  });
}

function renderView(
  view: ZoneViewTarget,
  zone: Parameters<typeof stateWith>[0],
  options: Parameters<typeof renderWithProviders>[1] = {},
) {
  const handleClose = vi.fn();
  const result = renderWithProviders(<ZoneViewDialog view={view} handleClose={handleClose} />, {
    preloadedState: stateWith(zone),
    ...options,
  });
  return { handleClose, ...result };
}

function panel(title: RegExp): HTMLElement {
  return screen.getByRole('heading', { name: title }).closest<HTMLElement>('.pointer-events-auto.resize')!;
}

const GRAVE = /^Graveyard/;

function viewCards(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>('[data-card][data-card-id]'));
}

afterEach(() => {
  window.localStorage.clear();
  settingsStore.reset();
});

describe('ZoneViewDialog', () => {
  it('lists a public zone under its owner\'s name', () => {
    renderView({ playerId: 1, zoneName: ZoneName.GRAVE }, { name: ZoneName.GRAVE, cards: [OPT, DURESS], cardCount: 2 });

    const view = panel(/^Graveyard — Trajer/);
    expect(viewCards(view).map((el) => el.dataset.cardId).sort()).toEqual(['7', '8']);
    expect(within(view).queryByRole('checkbox', { name: 'ZoneViewPanel.shuffleOnClose' })).not.toBeInTheDocument();
  });

  it('lists the library\'s dump snapshot and passes its shuffle choice on close', () => {
    const { handleClose } = renderView(
      { playerId: 1, zoneName: ZoneName.DECK },
      { name: ZoneName.DECK, cardCount: 40, revealedCards: [makeCard({ id: 0, name: 'Island' })] },
    );
    const view = panel(/^Trajer's library/);
    expect(viewCards(view)).toHaveLength(1);
    const shuffle = within(view).getByRole('checkbox', { name: 'ZoneViewPanel.shuffleOnClose' });
    expect(shuffle).toBeChecked();

    fireEvent.click(within(view).getByTitle('ZoneViewPanel.close'));
    expect(handleClose).toHaveBeenLastCalledWith(true);

    fireEvent.click(shuffle);
    fireEvent.click(within(view).getByTitle('ZoneViewPanel.close'));
    expect(handleClose).toHaveBeenLastCalledWith(false);
  });

  it('focuses its search box when it opens, as desktop does by default', () => {
    renderView({ playerId: 1, zoneName: ZoneName.GRAVE }, { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 });
    expect(within(panel(GRAVE)).getByRole('textbox')).toHaveFocus();
  });

  it('leaves the focus alone with "Auto focus search bar" off', async () => {
    const settings = await getSettings();
    settingsStore.setValue(Object.assign(settings, { focusCardViewSearchBar: false }));
    renderView({ playerId: 1, zoneName: ZoneName.GRAVE }, { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 });
    expect(within(panel(GRAVE)).getByRole('textbox')).not.toHaveFocus();
  });

  it('has no search box while "Keep game chat focused" is on, as desktop hides it', async () => {
    const settings = await getSettings();
    settingsStore.setValue(Object.assign(settings, { keepGameChatFocus: true }));
    renderView({ playerId: 1, zoneName: ZoneName.GRAVE }, { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 });
    expect(within(panel(GRAVE)).queryByRole('textbox')).not.toBeInTheDocument();
    expect(viewCards(panel(GRAVE))).toHaveLength(1);
  });

  describe('card view height, in desktop\'s rows', () => {
    const innerHeight = window.innerHeight;
    beforeEach(() => {
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 2000 });
    });
    afterEach(() => {
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
    });

    const dialogHeight = () => panel(GRAVE).style.height;

    it('opens at "Maximum initial height for card view window"', () => {
      renderView({ playerId: 1, zoneName: ZoneName.GRAVE }, { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 });
      expect(dialogHeight()).toBe('1013px');
    });

    it('follows the setting, and keeps a size the user set instead', async () => {
      const settings = await getSettings();
      settingsStore.setValue(Object.assign(settings, { cardViewInitialRowsMax: 5 }));
      const first = renderView({ playerId: 1, zoneName: ZoneName.GRAVE }, { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 });
      expect(dialogHeight()).toBe('408px');
      first.unmount();

      window.localStorage.setItem('webatrice.searchLibrarySize', JSON.stringify({ w: 900, h: 640 }));
      renderView({ playerId: 1, zoneName: ZoneName.GRAVE }, { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 });
      expect(dialogHeight()).toBe('640px');
    });

    it('opens no taller than its cards need', () => {
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function clientHeight() {
        return this.classList.contains('overflow-auto') ? 900 : 450;
      });
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function scrollHeight() {
        return this.classList.contains('overflow-auto') ? 900 : 450;
      });
      renderView({ playerId: 1, zoneName: ZoneName.GRAVE }, { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 });
      expect(dialogHeight()).toBe('450px');
    });

    it('switches to the expanded height on a title bar double-click', () => {
      renderView({ playerId: 1, zoneName: ZoneName.GRAVE }, { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 });
      const content = panel(GRAVE).querySelector<HTMLElement>('.overflow-auto')!;
      content.getBoundingClientRect = () => new DOMRect(0, 0, 900, 1013);
      panel(GRAVE).getBoundingClientRect = () => new DOMRect(0, 0, 900, 1013);
      fireEvent.doubleClick(screen.getByRole('heading', { name: GRAVE }));
      expect(dialogHeight()).toBe('1416px');
    });

    it('expands and shrinks from a header button too, for the keyboard', () => {
      renderView({ playerId: 1, zoneName: ZoneName.GRAVE }, { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 });
      const content = panel(GRAVE).querySelector<HTMLElement>('.overflow-auto')!;
      content.getBoundingClientRect = () => new DOMRect(0, 0, 900, 1013);
      panel(GRAVE).getBoundingClientRect = () => new DOMRect(0, 0, 900, 1013);
      const expand = within(panel(GRAVE)).getByRole('button', { name: 'ZoneViewPanel.expand' });
      expect(expand).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(expand);
      expect(dialogHeight()).toBe('1416px');
      expect(expand).toHaveAttribute('aria-pressed', 'true');

      content.getBoundingClientRect = () => new DOMRect(0, 0, 900, 1416);
      panel(GRAVE).getBoundingClientRect = () => new DOMRect(0, 0, 900, 1416);
      fireEvent.doubleClick(expand);
      expect(dialogHeight()).toBe('1416px');
      fireEvent.click(expand);
      expect(dialogHeight()).toBe('1013px');
      expect(expand).toHaveAttribute('aria-pressed', 'false');
    });

    it('expands no taller than its cards need, as desktop caps the view at its contents', () => {
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function scrollHeight() {
        return this.classList.contains('overflow-auto') ? 900 : 450;
      });
      renderView({ playerId: 1, zoneName: ZoneName.GRAVE }, { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 });
      const content = panel(GRAVE).querySelector<HTMLElement>('.overflow-auto')!;
      content.getBoundingClientRect = () => new DOMRect(0, 0, 900, 900);
      panel(GRAVE).getBoundingClientRect = () => new DOMRect(0, 0, 900, 900);
      fireEvent.doubleClick(screen.getByRole('heading', { name: GRAVE }));
      expect(dialogHeight()).toBe('450px');
    });

    it('never shrinks on expand when the initial rows exceed the expanded rows', async () => {
      const settings = await getSettings();
      settingsStore.setValue(Object.assign(settings, { cardViewInitialRowsMax: 8, cardViewExpandedRowsMax: 5 }));
      renderView({ playerId: 1, zoneName: ZoneName.GRAVE }, { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 });
      expect(dialogHeight()).toBe('610px');
      const content = panel(GRAVE).querySelector<HTMLElement>('.overflow-auto')!;
      content.getBoundingClientRect = () => new DOMRect(0, 0, 900, 610);
      panel(GRAVE).getBoundingClientRect = () => new DOMRect(0, 0, 900, 610);
      fireEvent.doubleClick(screen.getByRole('heading', { name: GRAVE }));
      expect(dialogHeight()).toBe('610px');
    });
  });

  it('closes from its search box on Escape, which the game shortcut skips', () => {
    const { handleClose } = renderView(
      { playerId: 1, zoneName: ZoneName.GRAVE },
      { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 },
    );

    fireEvent.keyDown(within(panel(GRAVE)).getByRole('textbox'), { key: 'Escape' });

    expect(handleClose).toHaveBeenCalledWith(false);
  });

  it('lists a top / bottom N view in server order, labelled by deck position', () => {
    const { handleClose } = renderView(
      { playerId: 1, zoneName: ZoneName.DECK, numberCards: 3, isReversed: true },
      {
        name: ZoneName.DECK,
        cardCount: 10,
        revealedCards: [7, 8, 9].map((id) => makeCard({ id, name: `C${id}` })),
      },
    );
    const view = panel(/^Bottom 3 cards — Trajer/);

    expect(viewCards(view).map((el) => el.dataset.cardId)).toEqual(['7', '8', '9']);
    expect(within(view).getByText('Bottom')).toBeInTheDocument();
    expect(within(view).getByText('7')).toBeInTheDocument();

    fireEvent.click(within(view).getAllByRole('button', { name: 'Common.action.close' })[0]);
    expect(handleClose).toHaveBeenCalledWith(false);
  });

  it('drags only the local player\'s own cards', () => {
    renderView({ playerId: 1, zoneName: ZoneName.GRAVE }, { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 });
    renderView({ playerId: 2, zoneName: ZoneName.GRAVE }, { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 });

    expect(viewCards(panel(/^Graveyard — Trajer/))[0]).toHaveStyle({ cursor: 'grab' });
    expect(viewCards(panel(/^Graveyard — Opp/))[0].style.cursor).toBe('');
  });

  it('opens the owning seat\'s card menu for a graveyard or exile card', () => {
    const openSeatCardMenu = vi.fn();
    renderView(
      { playerId: 2, zoneName: ZoneName.GRAVE },
      { name: ZoneName.GRAVE, cards: [OPT], cardCount: 1 },
      { gameDialogs: { openSeatCardMenu } },
    );

    fireEvent.contextMenu(viewCards(panel(GRAVE))[0], { clientX: 5, clientY: 6 });

    expect(openSeatCardMenu).toHaveBeenCalledWith({
      kind: 'pile',
      playerId: 2,
      zone: ZoneName.GRAVE,
      cardId: '7',
      cardName: 'Opt',
      x: 5,
      y: 6,
      viewCardIds: ['7'],
      columnCardIds: ['7'],
    });
  });

  it('offers no card menu in a hand view', () => {
    const openSeatCardMenu = vi.fn();
    renderView(
      { playerId: 1, zoneName: ZoneName.HAND },
      { name: ZoneName.HAND, cards: [OPT], cardCount: 1 },
      { gameDialogs: { openSeatCardMenu } },
    );

    fireEvent.contextMenu(viewCards(panel(/^Hand/))[0]);

    expect(openSeatCardMenu).not.toHaveBeenCalled();
  });

  it('shows the game selection, and drops its own cards from it on close', () => {
    let keys: ReadonlySet<string> = new Set(['1-grave-7', '1-table-3']);
    const setSelectedCardKeys = vi.fn((next: ReadonlySet<string> | ((prev: ReadonlySet<string>) => ReadonlySet<string>)) => {
      keys = typeof next === 'function' ? next(keys) : next;
    });
    const { unmount } = renderWithProviders(
      <GameSelectionProvider selectedCardKeys={keys} setSelectedCardKeys={setSelectedCardKeys}>
        <ZoneViewDialog view={{ playerId: 1, zoneName: ZoneName.GRAVE }} handleClose={() => undefined} />
      </GameSelectionProvider>,
      { preloadedState: stateWith({ name: ZoneName.GRAVE, cards: [OPT, DURESS], cardCount: 2 }) },
    );
    const [first, second] = viewCards(panel(GRAVE)).sort((a, b) => a.dataset.cardId!.localeCompare(b.dataset.cardId!));

    expect(first.style.boxShadow).not.toBe('');
    expect(second.style.boxShadow).toBe('');

    act(() => unmount());
    expect([...keys]).toEqual(['1-table-3']);
  });
});
