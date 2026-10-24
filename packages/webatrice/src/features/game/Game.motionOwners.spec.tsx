import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { makeCard } from '@cockatrice/datatrice/testing';
import { PREFERENCE_DEFAULTS } from '@app/types';
import AppThemeProvider from '../../components/AppThemeProvider/AppThemeProvider';
import { renderWithProviders } from '../../__test-utils__';
import { mountBoardStyles } from '../../__test-utils__/boardStyles';
import { getSettings, settingsStore } from '../../hooks/useSettings';
import { buildSeatGameState } from './__test-utils__/seatFixtures';
import ZoneViewPanel from './dialogs/ZoneViewDialog/ZoneViewPanel';
import ZoneRevealPanel from './dialogs/ZoneViewDialog/ZoneRevealPanel';
import IncomingRevealDialog from './dialogs/IncomingRevealDialog/IncomingRevealDialog';
import PhaseTrack from './components/PhaseTrack/PhaseTrack';

const catalog = vi.hoisted(() => ({ pending: false }));

vi.mock('@app/services', async (importOriginal) => ({
  ...await importOriginal<typeof import('@app/services')>(),
  lookupCardsCached: vi.fn(async (names: string[]) => {
    if (catalog.pending) {
      return new Promise(() => {});
    }
    return new Map(names.map((name) => [name, {
      found: false, source: 'unknown', name, printings: [],
    }]));
  }),
}));

let styles: HTMLStyleElement;
beforeEach(async () => {
  styles = await mountBoardStyles();
});
afterEach(() => {
  catalog.pending = false;
  cleanup();
  styles?.remove();
  settingsStore.reset();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset.animations;
  delete document.documentElement.dataset.theme;
});

async function setPolicy(disabled: boolean, scaleCards = true) {
  const settings = await getSettings();
  act(() => settingsStore.setValue(Object.assign(settings, PREFERENCE_DEFAULTS, {
    animationsChosen: true, tapAnimation: !disabled, arrowDrawAnimation: !disabled,
    lifeCounterAnimations: !disabled, battlefieldFlash: !disabled, scaleCards,
  })));
}

async function renderOwners() {
  const state = buildSeatGameState({ localPlayerId: 1, seats: [{ playerId: 1 }, { playerId: 2 }] });
  state.games!.incomingReveal = {
    gameId: 1, sourceOwnerId: 2, zoneName: ZoneName.HAND,
    cards: [makeCard({ id: 2, name: 'Forest' })], grantWriteAccess: false,
  };
  state.games!.games![1]!.players![2]!.zones![ZoneName.HAND]!.revealedCards = state.games!.incomingReveal.cards;
  await act(async () => {
    renderWithProviders(<AppThemeProvider>
      <PhaseTrack />
      <ZoneViewPanel title="Zone view" library={[{ id: '1', name: 'Island', scryfallId: '' }]}
        onClose={() => {}} selectedIds={new Set()} onSelectedIdsChange={() => {}} />
      <ZoneRevealPanel title="Reveal view" cards={[{ id: '3', name: 'Mountain', scryfallId: '' }]} onClose={() => {}} />
      <IncomingRevealDialog />
    </AppThemeProvider>, { preloadedState: state });
  });
}

describe('rendered board motion owners', () => {
  it('stops the real reveal loading indicator while leaving its status visible', async () => {
    catalog.pending = true;
    await setPolicy(true);
    await renderOwners();
    catalog.pending = false;
    const label = screen.getAllByText(/^loading card details…$/i)
      .find((element) => element.querySelector('svg'));
    expect(label).toBeDefined();
    const spinner = label!.querySelector('svg')!;
    expect(spinner).toBeInTheDocument();
    expect(getComputedStyle(spinner).animation).toBe('none');
  });

  it('stops the phase track, phase and pass buttons, hover wrappers and reveal fade', async () => {
    await setPolicy(true);
    await renderOwners();
    const track = screen.getByTestId('phase-bar');
    fireEvent.mouseEnter(track);
    const owners = [track, ...track.querySelectorAll('button'),
      screen.getByTitle('Island').parentElement!, screen.getByTitle('Forest').parentElement!,
      screen.getByTitle('Mountain').parentElement!];
    for (const owner of owners) {
      expect.soft(getComputedStyle(owner).transition, owner.getAttribute('class') ?? owner.tagName).toBe('none');
    }
  });

  it.each(['Island', 'Forest'])('%s pile hover follows Scale cards on the actual wrapper', async (name) => {
    await setPolicy(false);
    await renderOwners();
    const wrapper = screen.getByTitle(name).parentElement!;
    expect(getComputedStyle(wrapper).transitionProperty).toBe('transform');
    expect(getComputedStyle(wrapper).transitionDuration).toBe('150ms');
    expect(wrapper.parentElement).toHaveClass('group');
    wrapper.parentElement!.setAttribute('data-test-hover', '');
    expect(getComputedStyle(wrapper).getPropertyValue('--tw-scale-x')).toBe('var(--card-hover-scale,1.1)');
    expect(document.documentElement.style.getPropertyValue('--card-hover-scale')).toBe('1.1');
    await setPolicy(false, false);
    expect(document.documentElement.style.getPropertyValue('--card-hover-scale')).toBe('1');
    expect(getComputedStyle(wrapper).getPropertyValue('--tw-scale-x')).toBe('var(--card-hover-scale,1.1)');
  });
});
