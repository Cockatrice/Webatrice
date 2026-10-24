import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { create } from '@bufbuild/protobuf';
import { games } from '@cockatrice/datatrice';
import { Event_SetCounterSchema } from '@cockatrice/sockatrice/generated';

import { getSettings, settingsStore } from '../../../../../hooks/useSettings';
import { LIFE_COUNTER_ID, MANA_COUNTER_IDS, renderSeatCell, type SeatGameSpec } from '../../../__test-utils__/seatFixtures';

vi.mock('../../../../../services/cards/catalog/lookup', async () =>
  (await import('../../../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  seats: [
    { playerId: 1, name: 'Alice', life: 18 },
    { playerId: 2, name: 'Bob' },
  ],
};

const lifePill = (name: string) => screen.getByLabelText(`${name}'s life`);

describe('PlayerInfoPanel', () => {
  it('shows the player, the life total and the seven mana pool counters', () => {
    renderSeatCell(SPEC);
    expect(lifePill('Alice')).toHaveTextContent('Alice18');
    expect(['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless', 'Other'].map((label) => screen.getByTitle(label).textContent))
      .toEqual(['0', '0', '0', '0', '0', '0', '0']);
    expect(lifePill('Alice')).toHaveAttribute('data-arrow-target-player-id', '1');
  });

  it('lets the owner click the life total up and right-click it down', () => {
    const { game } = renderSeatCell(SPEC);
    fireEvent.click(lifePill('Alice'));
    fireEvent.contextMenu(lifePill('Alice'));
    expect(vi.mocked(game.incCounter).mock.calls.map(([, params]) => params)).toEqual([
      { counterId: LIFE_COUNTER_ID, delta: 1 },
      { counterId: LIFE_COUNTER_ID, delta: -1 },
    ]);
  });

  it('lets the owner add and remove mana with a click and a right-click', () => {
    const { game } = renderSeatCell(SPEC);
    fireEvent.click(screen.getByTitle('Green'));
    fireEvent.contextMenu(screen.getByTitle('Other'));
    expect(vi.mocked(game.incCounter).mock.calls.map(([, params]) => params)).toEqual([
      { counterId: MANA_COUNTER_IDS.g, delta: 1 },
      { counterId: MANA_COUNTER_IDS.storm, delta: -1 },
    ]);
  });

  it('is read-only on another player\'s seat', () => {
    const { game } = renderSeatCell(SPEC, 2);
    fireEvent.click(lifePill('Bob'));
    fireEvent.click(screen.getByTitle('Green'));
    expect(game.incCounter).not.toHaveBeenCalled();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  describe('from the keyboard', () => {
    it('makes the owner\'s life total a spin button that reads out the total', () => {
      renderSeatCell(SPEC);
      const life = screen.getByRole('spinbutton', { name: 'Alice\'s life' });
      expect(life).toHaveAttribute('aria-valuenow', '18');
      expect(life).toHaveAttribute('tabindex', '0');
    });

    it('changes life by one with the up and down arrows', async () => {
      const user = userEvent.setup();
      const { game } = renderSeatCell(SPEC);
      screen.getByRole('spinbutton', { name: 'Alice\'s life' }).focus();
      await user.keyboard('{ArrowUp}{ArrowDown}{ArrowDown}');
      expect(vi.mocked(game.incCounter).mock.calls.map(([, params]) => params)).toEqual([
        { counterId: LIFE_COUNTER_ID, delta: 1 },
        { counterId: LIFE_COUNTER_ID, delta: -1 },
        { counterId: LIFE_COUNTER_ID, delta: -1 },
      ]);
    });

    it('opens the set-life prompt with Enter, as desktop\'s "Set counter..."', async () => {
      const user = userEvent.setup();
      const openPrompt = vi.fn();
      renderSeatCell(SPEC, 1, { gameDialogs: { openPrompt } });
      screen.getByRole('spinbutton', { name: 'Alice\'s life' }).focus();
      await user.keyboard('{Enter}');
      expect(openPrompt).toHaveBeenCalledWith(expect.objectContaining({ title: 'Set life total', initialValue: '18' }));
    });

    it('reads another player\'s life total as a named group with the number in it', () => {
      renderSeatCell(SPEC, 2);
      const life = screen.getByRole('group', { name: 'Bob\'s life' });
      expect(life).not.toHaveAttribute('tabindex');
      expect(life).toHaveTextContent('Bob');
    });

    it('makes the mana pool one tab stop, moving between counters with the side arrows', async () => {
      const user = userEvent.setup();
      renderSeatCell(SPEC);
      const pool = screen.getByRole('group', { name: 'Mana pool' });
      const pips = within(pool).getAllByRole('spinbutton');
      expect(pips.map((pip) => pip.getAttribute('aria-label')))
        .toEqual(['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless', 'Other']);
      expect(pips.map((pip) => pip.tabIndex)).toEqual([0, -1, -1, -1, -1, -1, -1]);

      pips[0].focus();
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(pips[2]).toHaveFocus();
      await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
      expect(pips[6]).toHaveFocus();
      expect(pips.map((pip) => pip.tabIndex)).toEqual([-1, -1, -1, -1, -1, -1, 0]);
    });

    it('adds and removes mana with the up and down arrows', async () => {
      const user = userEvent.setup();
      const { game } = renderSeatCell(SPEC);
      const green = screen.getByRole('spinbutton', { name: 'Green' });
      expect(green).toHaveAttribute('aria-valuenow', '0');
      green.focus();
      await user.keyboard('{ArrowUp}{ArrowDown}');
      expect(vi.mocked(game.incCounter).mock.calls.map(([, params]) => params)).toEqual([
        { counterId: MANA_COUNTER_IDS.g, delta: 1 },
        { counterId: MANA_COUNTER_IDS.g, delta: -1 },
      ]);
    });

    it('reads an opponent\'s mana counters as their colour and count', () => {
      renderSeatCell(SPEC, 2);
      expect(within(screen.getByRole('group', { name: 'Mana pool' })).getByTitle('Green')).toHaveTextContent('Green0');
    });
  });

  describe('life counter flash', () => {
    type Store = ReturnType<typeof renderSeatCell>['store'];
    const setLife = (store: Store, value: number) => act(() => {
      store.dispatch(games.Actions.counterSet({
        gameId: 1,
        playerId: 1,
        data: create(Event_SetCounterSchema, { counterId: LIFE_COUNTER_ID, value }),
      }));
    });

    afterEach(() => {
      settingsStore.reset();
    });

    it('flashes green on a gain and red on a loss, over the life total and the battlefield', () => {
      const { store } = renderSeatCell(SPEC);
      expect(screen.queryByTestId(/^value-flash-/)).not.toBeInTheDocument();

      setLife(store, 20);
      expect(lifePill('Alice')).toContainElement(screen.getByTestId('value-flash-gain'));
      expect(screen.queryByTestId('value-flash-damage')).not.toBeInTheDocument();

      setLife(store, 15);
      expect(lifePill('Alice')).toContainElement(screen.getByTestId('value-flash-loss'));
      const battlefield = document.querySelector('[data-battlefield-owner="1"]')!;
      expect(screen.getByTestId('value-flash-damage').parentElement).toContainElement(battlefield as HTMLElement);
    });

    it('stays still with the life counter and battlefield flashes off', async () => {
      const settings = await getSettings();
      settingsStore.setValue(Object.assign(settings, {
        animationsChosen: true,
        lifeCounterAnimations: false,
        battlefieldFlash: false,
      }));
      const { store } = renderSeatCell(SPEC);
      setLife(store, 12);
      expect(screen.queryByTestId(/^value-flash-/)).not.toBeInTheDocument();
    });
  });
});
