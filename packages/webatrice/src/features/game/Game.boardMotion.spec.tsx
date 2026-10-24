import { act, cleanup, screen } from '@testing-library/react';
import { makeCard } from '@cockatrice/datatrice/testing';
import { PREFERENCE_DEFAULTS } from '@app/types';
import AppThemeProvider from '../../components/AppThemeProvider/AppThemeProvider';
import { renderWithProviders } from '../../__test-utils__';
import { mountBoardStyles } from '../../__test-utils__/boardStyles';
import { getSettings, settingsStore } from '../../hooks/useSettings';
import { chooseAnimations } from '../../hooks/useAnimationPreferences';
import { buildSeatGameState } from './__test-utils__/seatFixtures';
import Game from './Game';

vi.mock('../../services/cards/cardCatalog', () => {
  const unknown = (name: string) => ({ found: false, source: 'unknown', name, printings: [] });
  return {
    lookupCard: vi.fn(async (name: string) => unknown(name)),
    lookupCards: vi.fn(async () => new Map()),
    lookupCardsCached: vi.fn(async () => new Map()),
    fetchAllPrintings: vi.fn(async () => []),
  };
});

let styles: HTMLStyleElement;
beforeEach(async () => {
  styles = await mountBoardStyles();
});
afterEach(() => {
  cleanup();
  styles?.remove();
  settingsStore.reset();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset.animations;
  delete document.documentElement.dataset.theme;
});

describe('production board motion wiring', () => {
  it.each(['Disable all', 'reduced motion'] as const)('%s reaches the actual hand and board CSS', async (policy) => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: policy === 'reduced motion' && query === '(prefers-reduced-motion: reduce)',
      media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(),
    })));
    const settings = await getSettings();
    settingsStore.setValue(Object.assign(settings, PREFERENCE_DEFAULTS, policy === 'Disable all'
      ? chooseAnimations(PREFERENCE_DEFAULTS, false, {
        tapAnimation: false, arrowDrawAnimation: false, lifeCounterAnimations: false, battlefieldFlash: false,
      }) : {}));
    await act(async () => {
      renderWithProviders(<AppThemeProvider><Game /></AppThemeProvider>, {
        preloadedState: buildSeatGameState({ localPlayerId: 1, seats: [
          { playerId: 1, table: [makeCard({ id: 10, name: 'Island' })], hand: [makeCard({ id: 20, name: 'Opt' })] },
          { playerId: 2 },
        ] }),
      });
    });
    const card = screen.getByTitle('Opt');
    expect(getComputedStyle(card).transition).toBe('none');
    const track = screen.getByRole('navigation', { name: 'PhaseTrack.label' });
    expect(getComputedStyle(track).transition).toBe('none');
    const transitioning = screen.getByTestId('game-container').querySelectorAll('[class*="transition-"]');
    expect(transitioning.length).toBeGreaterThan(10);
    for (const element of transitioning) {
      expect(getComputedStyle(element).transition, element.getAttribute('class') ?? '').toBe('none');
    }
  });
});
