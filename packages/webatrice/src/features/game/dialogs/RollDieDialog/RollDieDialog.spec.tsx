import { screen, fireEvent } from '@testing-library/react';

import { renderWithProviders } from '../../../../__test-utils__';
import type { GameDialogs } from '../../hooks/useGameDialogs';
import RollDieDialog, { DEFAULT_DIE_SIDES, DEFAULT_DIE_COUNT } from './RollDieDialog';

// Self-sources open state, seeded last-roll values, and handlers from
// GameDialogsContext. rollDieOpen=true = open.
function render(dialogs: Partial<GameDialogs> = {}) {
  return renderWithProviders(<RollDieDialog />, {
    gameDialogs: {
      rollDieOpen: true,
      lastDieSides: DEFAULT_DIE_SIDES,
      lastDieCount: DEFAULT_DIE_COUNT,
      ...dialogs,
    },
  });
}

describe('RollDieDialog', () => {
  it('does not render when closed', () => {
    render({ rollDieOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('seeds the Sides input to the last sides (6) and Count to the last count (1)', () => {
    render();
    expect((screen.getByLabelText('Sides') as HTMLInputElement).value).toBe('6');
    expect((screen.getByLabelText('Count') as HTMLInputElement).value).toBe('1');
  });

  it('seeds the inputs with the most recent values', () => {
    render({ lastDieSides: 20, lastDieCount: 4 });
    expect((screen.getByLabelText('Sides') as HTMLInputElement).value).toBe('20');
    expect((screen.getByLabelText('Count') as HTMLInputElement).value).toBe('4');
  });

  it('dispatches the submit handler with both sides and count on Roll', () => {
    const handleRollDieSubmit = vi.fn();
    render({ handleRollDieSubmit });

    fireEvent.change(screen.getByLabelText('Sides'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Count'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /^roll$/i }));

    expect(handleRollDieSubmit).toHaveBeenCalledWith({ sides: 6, count: 4 });
  });

  it('accepts sides = 1 (matches desktop)', () => {
    const handleRollDieSubmit = vi.fn();
    render({ handleRollDieSubmit });

    fireEvent.change(screen.getByLabelText('Sides'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /^roll$/i }));

    expect(handleRollDieSubmit).toHaveBeenCalledWith({ sides: 1, count: 1 });
  });

  it('rejects sides < 1 and surfaces the error on the Sides field', () => {
    const handleRollDieSubmit = vi.fn();
    render({ handleRollDieSubmit });

    fireEvent.change(screen.getByLabelText('Sides'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /^roll$/i }));

    expect(handleRollDieSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/integer/i)).toBeInTheDocument();
  });

  it('rejects count < 1', () => {
    const handleRollDieSubmit = vi.fn();
    render({ handleRollDieSubmit });

    fireEvent.change(screen.getByLabelText('Count'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /^roll$/i }));

    expect(handleRollDieSubmit).not.toHaveBeenCalled();
  });

  it('dispatches the close handler on Cancel', () => {
    const closeRollDie = vi.fn();
    render({ closeRollDie });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(closeRollDie).toHaveBeenCalled();
  });
});
