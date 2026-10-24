import { act, cleanup, screen, within } from '@testing-library/react';
import { makeCard } from '@cockatrice/datatrice/testing';

import { getSettings, settingsStore } from '../../../../../hooks/useSettings';
import { battlefieldEl, cardEl, pileEl, renderSeatCell, type SeatGameSpec } from '../../../__test-utils__/seatFixtures';

vi.mock('../../../../../services/cards/catalog/lookup', async () =>
  (await import('../../../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  activePlayerId: 1,
  seats: [
    {
      playerId: 1,
      name: 'Alice',
      table: [makeCard({ id: 10, name: 'Bolt' })],
      stack: [makeCard({ id: 50, name: 'Shock' })],
      hand: [makeCard({ id: 30, name: 'Opt' })],
      deckCount: 9,
    },
    { playerId: 2, name: 'Bob', handCount: 2 },
  ],
};

const seatRoot = () => battlefieldEl(1).closest<HTMLElement>('.rounded-lg')!;

describe('PlayerBoard', () => {
  it('leaves life announcements to the game log instead of a second live region', () => {
    renderSeatCell(SPEC);
    const life = screen.getByLabelText('Alice\'s life');
    expect(life.closest('[aria-live]:not([aria-live="off"]), [role="status"], [role="log"]')).toBeNull();
    expect(life.querySelector('[aria-live]:not([aria-live="off"]), [role="status"], [role="log"]')).toBeNull();
  });

  it('composes the info column, the stack, the battlefield and the hand', () => {
    renderSeatCell(SPEC);
    expect(screen.getByLabelText('Alice\'s life')).toBeInTheDocument();
    expect(pileEl('Library')).toHaveAttribute('title', 'Library, 9 cards');
    expect(cardEl(50, 'stack')).toBeInTheDocument();
    expect(cardEl(10, 'battlefield')).toBeInTheDocument();
    expect(cardEl(30, 'hand')).toBeInTheDocument();
  });

  it('is a landmark named for its player, with its zones as listboxes named by owner and card count', () => {
    renderSeatCell(SPEC);
    const seat = screen.getByRole('region', { name: 'Alice\'s seat' });
    expect(seat).toBe(seatRoot());
    expect(within(seat).getByRole('listbox', { name: 'Alice\'s battlefield, 1 card' })).toBe(battlefieldEl(1));
    expect(within(seat).getByRole('listbox', { name: 'Alice\'s stack, 1 card' })).toContainElement(cardEl(50, 'stack'));
    expect(within(seat).getByRole('listbox', { name: 'Alice\'s hand, 1 card' })).toContainElement(cardEl(30, 'hand'));
  });

  it('keeps the battlefield and hand scrollers out of the tab order, where Tab is the board\'s Next Phase', () => {
    renderSeatCell(SPEC);
    expect(battlefieldEl(1)).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('listbox', { name: 'Alice\'s hand, 1 card' })).toHaveAttribute('tabindex', '-1');
  });

  it('names an opponent\'s hand by the server\'s count, in either hand layout', async () => {
    renderSeatCell(SPEC, 2);
    expect(screen.getByRole('img', { name: 'Hand, 2 cards' })).toBeInTheDocument();
    cleanup();
    const settings = await getSettings();
    settingsStore.setValue(Object.assign(settings, { horizontalHand: false }));
    renderSeatCell(SPEC, 2);
    expect(screen.getByRole('img', { name: 'Hand, 2 cards' })).toBeInTheDocument();
    settingsStore.reset();
  });

  it('puts the hand row below the play area on the local seat, and glows on its turn', () => {
    renderSeatCell(SPEC);
    expect(seatRoot().style.gridTemplateRows).toMatch(/^1fr /);
    expect(seatRoot()).toHaveClass('border-accent');
  });

  it('gives a mirrored opponent seat a single row with no hand strip', () => {
    renderSeatCell(SPEC, 2);
    const root = battlefieldEl(2).closest<HTMLElement>('.rounded-lg')!;
    expect(root.style.gridTemplateRows).toBe('1fr');
    expect(root).toHaveClass('border-border-subtle');
  });

  it('draws each zone\'s background in its own region, under its content', async () => {
    const params = { marginPctL: 0, marginPctR: 0, verticalOffset: 0, zoom: 1 };
    const art = (cardName: string) => ({ cardName, cardProviderId: '', params });
    const settings = await getSettings();
    await act(async () => {
      settingsStore.setValue(Object.assign(settings, {
        zoneBackgrounds: { hand: art('Island'), stack: art('Swamp'), table: art('Forest'), playerInfo: art('Plains') },
      }));
    });
    renderSeatCell(SPEC);

    const region = (zone: string) => screen.getByTestId(`zone-background-${zone}`).parentElement!;
    expect(region('hand')).toContainElement(cardEl(30, 'hand'));
    expect(region('stack')).toContainElement(cardEl(50, 'stack'));
    expect(region('table')).toContainElement(battlefieldEl(1));
    expect(region('playerInfo')).toContainElement(screen.getByLabelText('Alice\'s life'));
    for (const zone of ['hand', 'stack', 'table', 'playerInfo']) {
      expect(region(zone).className + region(zone).style.zIndex).toMatch(/isolate|30/);
    }
    settingsStore.reset();
  });
});
