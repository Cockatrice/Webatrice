import { act, fireEvent, renderHook, screen, within } from '@testing-library/react';
import { makeCard } from '@cockatrice/datatrice/testing';

import { PREFERENCE_DEFAULTS } from '@app/types';
import { createMockWebClient, renderWithProviders } from '../../../../__test-utils__';
import { testI18n } from '../../../../__test-utils__/renderWithProviders';
import tallyText from './TallyOverlay.i18n.json';
import { usePreferences } from '../../../../hooks/useSettings';
import {
  battlefieldEl,
  buildSeatGameState,
  cardEl,
  chooseMenuPath,
  openContextMenu,
} from '../../__test-utils__/seatFixtures';
import Game from '../../Game';
import { useTallyType } from '../../hooks/useTallyType';

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

const OGRE = makeCard({ id: 10, name: 'Ogre', x: 0, y: 0, pt: '3/3' });
const ELF = makeCard({ id: 11, name: 'Elf', x: 3, y: 0, pt: '1/1' });

function renderGame() {
  const { store } = renderWithProviders(<Game />, {
    preloadedState: buildSeatGameState({
      localPlayerId: 1,
      seats: [{ playerId: 1, table: [OGRE, ELF] }, { playerId: 2 }],
    }),
    webClient: createMockWebClient(),
  });
  return store;
}

function tally() {
  return screen.queryByRole('status', { name: 'Tally' });
}

function selectCard(cardId: number, ctrlKey = false) {
  const card = cardEl(cardId, 'battlefield');
  act(() => fireEvent.pointerDown(card, { button: 0, clientX: 50, clientY: 50 }));
  act(() => fireEvent.pointerUp(window, { button: 0, clientX: 50, clientY: 50, ctrlKey }));
}

beforeEach(() => {
  testI18n.addResourceBundle('en-US', 'translation', tallyText, true, true);
  const { result } = renderHook(() => useTallyType());
  act(() => result.current[1]('none'));
});

describe('TallyOverlay', () => {
  it('stays hidden until a tally is chosen, then totals the selection', async () => {
    renderGame();
    openContextMenu(cardEl(OGRE.id, 'battlefield'));
    chooseMenuPath('Select All');
    expect(tally()).not.toBeInTheDocument();

    openContextMenu(battlefieldEl(1));
    chooseMenuPath('Tally', 'Total Power');
    await act(async () => {});

    expect(within(tally()!).getByText('Total Power')).toBeInTheDocument();
    expect(within(tally()!).getByText('4')).toBeInTheDocument();
  });

  it('is chosen from an opponent\'s menu too, and hides again with nothing selected', async () => {
    renderGame();
    openContextMenu(battlefieldEl(2));
    chooseMenuPath('Tally', 'Total Toughness');
    await act(async () => {});
    expect(tally()).not.toBeInTheDocument();

    openContextMenu(cardEl(ELF.id, 'battlefield'));
    chooseMenuPath('Select All');
    await act(async () => {});
    expect(within(tally()!).getByText('Total Toughness')).toBeInTheDocument();
    expect(within(tally()!).getByText('4')).toBeInTheDocument();
  });

  it('announces selection changes from a stable live region with no tally chosen', () => {
    renderGame();
    const announcement = screen.getByText('0 cards selected', { selector: '[role="status"]' });
    expect(announcement).toHaveClass('sr-only');
    expect(announcement).toHaveAttribute('aria-live', 'polite');
    expect(announcement).toHaveTextContent('0 cards selected');

    selectCard(OGRE.id);
    expect(screen.getByText('1 card selected', { selector: '[role="status"]' })).toBe(announcement);

    selectCard(ELF.id, true);

    expect(screen.getByText('2 cards selected', { selector: '[role="status"]' })).toBe(announcement);
    expect(announcement).toHaveTextContent('2 cards selected');
    expect(screen.getByText('2', { selector: '[aria-hidden="true"]' })).toBeInTheDocument();
    expect(tally()).not.toBeInTheDocument();
  });

  it('hides the selection count with "Show total selection count" off', () => {
    vi.mocked(usePreferences).mockReturnValue({ ...PREFERENCE_DEFAULTS, showTotalSelectionCount: false });
    renderGame();

    openContextMenu(cardEl(OGRE.id, 'battlefield'));
    chooseMenuPath('Select All');

    expect(screen.getByText('2 cards selected', { selector: '[role="status"]' })).toBeInTheDocument();
    expect(screen.queryByText('2', { selector: '[aria-hidden="true"]' })).not.toBeInTheDocument();
    vi.mocked(usePreferences).mockReturnValue(PREFERENCE_DEFAULTS);
  });
});
