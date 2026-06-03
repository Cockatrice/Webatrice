import { screen, fireEvent } from '@testing-library/react';

import { renderWithProviders } from '../../../../__test-utils__';
import type { GameDialogs } from '../../hooks/useGameDialogs';
import CreateTokenDialog from './CreateTokenDialog';

// Self-sources its open state + submit/cancel handlers from GameDialogsContext.
// createTokenOpen=true = open.
function render(dialogs: Partial<GameDialogs> = {}) {
  return renderWithProviders(<CreateTokenDialog />, {
    gameDialogs: { createTokenOpen: true, ...dialogs },
  });
}

describe('CreateTokenDialog', () => {
  it('submits the trimmed name, selected color, P/T, annotation, and flags', () => {
    const handleCreateTokenSubmit = vi.fn();
    render({ handleCreateTokenSubmit });

    fireEvent.change(screen.getByLabelText('Token name'), {
      target: { value: '  Goblin  ' },
    });
    fireEvent.change(screen.getByLabelText('Token power/toughness'), {
      target: { value: '1/1' },
    });
    fireEvent.change(screen.getByLabelText('Token annotation'), {
      target: { value: 'ETB' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    // Default color is White ('w') to match desktop DlgCreateToken default.
    expect(handleCreateTokenSubmit).toHaveBeenCalledWith({
      name: 'Goblin',
      color: 'w',
      pt: '1/1',
      annotation: 'ETB',
      destroyOnZoneChange: true,
      faceDown: false,
    });
  });

  it('requires a non-empty name', () => {
    const handleCreateTokenSubmit = vi.fn();
    render({ handleCreateTokenSubmit });

    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(handleCreateTokenSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });

  it('caps the name input at the desktop max (255 chars)', () => {
    render();

    const input = screen.getByLabelText('Token name') as HTMLInputElement;
    const longInput = 'x'.repeat(300);
    fireEvent.change(input, { target: { value: longInput } });

    expect(input.value.length).toBeLessThanOrEqual(255);
  });

  it('toggles the destroyOnZoneChange checkbox off when unchecked', () => {
    const handleCreateTokenSubmit = vi.fn();
    render({ handleCreateTokenSubmit });

    fireEvent.change(screen.getByLabelText('Token name'), {
      target: { value: 'Persistent' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', { name: /destroy when it leaves the table/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(handleCreateTokenSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ destroyOnZoneChange: false }),
    );
  });

  it('fires the close handler when Cancel is clicked', () => {
    const closeCreateToken = vi.fn();
    render({ closeCreateToken });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(closeCreateToken).toHaveBeenCalled();
  });
});
