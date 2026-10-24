import { ZoneName } from '@cockatrice/sockatrice';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';

import { makeStoreState, renderWithProviders } from '../../../../__test-utils__';
import MoveTopUntilDialog from './MoveTopUntilDialog';

function renderDialog({ deckCount = 7, open = true } = {}) {
  const onSubmit = vi.fn();
  const closeMoveTopUntil = vi.fn();
  renderWithProviders(<MoveTopUntilDialog />, {
    preloadedState: makeStoreState({
      games: {
        games: {
          1: makeGameEntry({
            localPlayerId: 1,
            players: {
              1: makePlayerEntry({
                properties: makePlayerProperties({ playerId: 1 }),
                zones: { [ZoneName.DECK]: makeZoneEntry({ name: ZoneName.DECK, cardCount: deckCount }) },
              }),
            },
          }),
        },
      },
    }),
    gameDialogs: { moveTopUntil: open ? { onSubmit } : null, closeMoveTopUntil },
  });
  return { onSubmit, closeMoveTopUntil };
}

const dialog = () => screen.getByRole('dialog', { name: 'Put top cards on stack until…' });
const startButton = () => within(dialog()).getByRole('button', { name: 'Start' });

describe('MoveTopUntilDialog', () => {
  it('renders nothing while closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the local library size and submits the trimmed filter, hits and auto play', () => {
    const { onSubmit } = renderDialog();
    expect(within(dialog()).getByText('Library size: 7')).toBeInTheDocument();

    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: '  t:creature ' } });
    fireEvent.change(within(dialog()).getByRole('spinbutton'), { target: { value: '3' } });
    fireEvent.click(within(dialog()).getByRole('checkbox', { name: 'Auto play hits' }));
    fireEvent.click(startButton());

    expect(onSubmit).toHaveBeenCalledWith({ filter: 't:creature', hits: 3, autoPlay: true });
  });

  it.each([
    ['an empty filter', ' ', '1'],
    ['no hits', 'Bolt', '0'],
    ['over 99 hits', 'Bolt', '100'],
    ['a non-number', 'Bolt', ''],
  ])('keeps Start disabled for %s', (_case, filter, hits) => {
    renderDialog();

    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: filter } });
    fireEvent.change(within(dialog()).getByRole('spinbutton'), { target: { value: hits } });

    expect(startButton()).toBeDisabled();
  });

  it('keeps Start disabled while the library is empty', () => {
    renderDialog({ deckCount: 0 });

    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: 'Bolt' } });

    expect(startButton()).toBeDisabled();
  });

  it('starts in the filter field, names its fields and keeps Tab inside', async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog()).getByRole('textbox', { name: 'Card name (or search expressions)' })).toHaveFocus();
    expect(within(dialog()).getByRole('spinbutton', { name: 'Number of hits' })).toBeInTheDocument();
    expect(dialog()).toHaveAccessibleDescription('Library size: 7');
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog()).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('cancels on Escape, Cancel and the backdrop', () => {
    const { closeMoveTopUntil, onSubmit } = renderDialog();

    fireEvent.keyDown(dialog(), { key: 'Escape' });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Common.action.cancel' }));
    fireEvent.click(dialog().previousElementSibling!);

    expect(closeMoveTopUntil).toHaveBeenCalledTimes(3);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
