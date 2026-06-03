import { screen, fireEvent } from '@testing-library/react';

import { renderWithProviders } from '../../../../../__test-utils__';
import type { GameDialogs } from '../../../hooks/useGameDialogs';
import PlayerContextMenu from './PlayerContextMenu';

// Self-sources its open state + openers from GameDialogsContext. playerMenu
// non-null = open.
function render(dialogs: Partial<GameDialogs> = {}) {
  return renderWithProviders(<PlayerContextMenu />, {
    gameDialogs: { playerMenu: { top: 10, left: 10 }, ...dialogs },
  });
}

describe('PlayerContextMenu', () => {
  it('opens create-token and closes when "Create token…" is clicked', () => {
    const openCreateToken = vi.fn();
    const closePlayerMenu = vi.fn();
    render({ openCreateToken, closePlayerMenu });

    fireEvent.click(screen.getByRole('menuitem', { name: /create token/i }));

    expect(openCreateToken).toHaveBeenCalled();
    expect(closePlayerMenu).toHaveBeenCalled();
  });

  it('opens the sideboard and closes when "View sideboard…" is clicked', () => {
    const openSideboard = vi.fn();
    const closePlayerMenu = vi.fn();
    render({ openSideboard, closePlayerMenu });

    fireEvent.click(screen.getByRole('menuitem', { name: /view sideboard/i }));

    expect(openSideboard).toHaveBeenCalled();
    expect(closePlayerMenu).toHaveBeenCalled();
  });

  it('does not render menu items when closed', () => {
    render({ playerMenu: null });

    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});
