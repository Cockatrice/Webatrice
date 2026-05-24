import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../__test-utils__';
import { rooms } from '@cockatrice/datatrice';
import FilterGamesDialog from './FilterGamesDialog';

function renderDialog(opts: { gametypeMap?: Record<number, string>; initialFilters?: typeof rooms.DEFAULT_GAME_FILTERS } = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  renderWithProviders(
    <FilterGamesDialog
      isOpen
      gametypeMap={opts.gametypeMap ?? {}}
      initialFilters={opts.initialFilters ?? rooms.DEFAULT_GAME_FILTERS}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return { onSubmit, onCancel };
}

describe('FilterGamesDialog', () => {
  it('renders the hide-toggles section', () => {
    renderDialog();
    expect(screen.getByLabelText(/Hide full games/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hide games that started/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hide password-protected games/i)).toBeInTheDocument();
  });

  it('disables spectator sub-filters until "show only if spectators can watch" is checked', () => {
    renderDialog();
    expect(screen.getByLabelText(/spectators need a password/i)).toBeDisabled();
    expect(screen.getByLabelText(/spectators can chat/i)).toBeDisabled();
    expect(screen.getByLabelText(/spectators see hands/i)).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Show only games where spectators can watch/i));

    expect(screen.getByLabelText(/spectators need a password/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/spectators can chat/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/spectators see hands/i)).not.toBeDisabled();
  });

  it('Apply submits the unchanged defaults when nothing is edited', () => {
    const { onSubmit } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    expect(onSubmit).toHaveBeenCalledWith(rooms.DEFAULT_GAME_FILTERS);
  });

  it('Apply forwards the toggled hide-full-games filter', () => {
    const { onSubmit } = renderDialog();
    fireEvent.click(screen.getByLabelText(/Hide full games/i));
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].hideFullGames).toBe(true);
  });

  it('parses the comma-separated creator names into a trimmed list', () => {
    const { onSubmit } = renderDialog();
    fireEvent.change(screen.getByLabelText(/Creator names/i), { target: { value: 'alice, bob ,carol' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    expect(onSubmit.mock.calls[0][0].creatorNameFilters).toEqual(['alice', 'bob', 'carol']);
  });

  it('renders a checkbox per game type and toggles selection', () => {
    const { onSubmit } = renderDialog({ gametypeMap: { 0: 'Constructed', 1: 'Limited' } });
    fireEvent.click(screen.getByLabelText('Constructed'));
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    expect(onSubmit.mock.calls[0][0].gameTypeFilter).toEqual([0]);
  });

  it('Reset restores defaults in the form (Apply submits defaults)', () => {
    const { onSubmit } = renderDialog({
      initialFilters: { ...rooms.DEFAULT_GAME_FILTERS, hideFullGames: true, gameNameFilter: 'foo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Reset/i }));
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    expect(onSubmit).toHaveBeenCalledWith(rooms.DEFAULT_GAME_FILTERS);
  });

  it('Cancel calls onCancel', () => {
    const { onCancel } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('forwards the gameNameFilter typed into "Game description contains"', () => {
    const { onSubmit } = renderDialog();
    fireEvent.change(screen.getByLabelText(/Game description contains/i), { target: { value: 'casual' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    expect(onSubmit.mock.calls[0][0].gameNameFilter).toBe('casual');
  });

  it('forwards min and max player numeric filters', () => {
    const { onSubmit } = renderDialog();
    fireEvent.change(screen.getByLabelText(/Min players/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Max players/i), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    expect(onSubmit.mock.calls[0][0].maxPlayersFilterMin).toBe(2);
    expect(onSubmit.mock.calls[0][0].maxPlayersFilterMax).toBe(6);
  });

  it('forwards the maxGameAgeSeconds when a Max age option is picked', () => {
    const { onSubmit } = renderDialog();
    fireEvent.mouseDown(screen.getByLabelText(/Max age/i));
    fireEvent.click(screen.getByRole('option', { name: /10 minutes/i }));
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    expect(onSubmit.mock.calls[0][0].maxGameAgeSeconds).toBe(600);
  });

  it('toggles every hide-* checkbox and forwards them on Apply', () => {
    const { onSubmit } = renderDialog();
    fireEvent.click(screen.getByLabelText(/Hide games that started/i));
    fireEvent.click(screen.getByLabelText(/Hide password-protected games/i));
    fireEvent.click(screen.getByLabelText(/Hide buddies-only games/i));
    fireEvent.click(screen.getByLabelText(/Hide games created by ignored users/i));
    fireEvent.click(screen.getByLabelText(/Hide games not created by buddies/i));
    fireEvent.click(screen.getByLabelText(/Hide open-decklist games/i));
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    const params = onSubmit.mock.calls[0][0];
    expect(params.hideGamesThatStarted).toBe(true);
    expect(params.hidePasswordProtectedGames).toBe(true);
    expect(params.hideBuddiesOnlyGames).toBe(true);
    expect(params.hideIgnoredUserGames).toBe(true);
    expect(params.hideNotBuddyCreatedGames).toBe(true);
    expect(params.hideOpenDecklistGames).toBe(true);
  });

  it('toggles every spectator-* sub-filter after enabling "spectators can watch"', () => {
    const { onSubmit } = renderDialog();
    fireEvent.click(screen.getByLabelText(/Show only games where spectators can watch/i));
    fireEvent.click(screen.getByLabelText(/spectators need a password/i));
    fireEvent.click(screen.getByLabelText(/spectators can chat/i));
    fireEvent.click(screen.getByLabelText(/spectators see hands/i));
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    const params = onSubmit.mock.calls[0][0];
    expect(params.showOnlyIfSpectatorsCanWatch).toBe(true);
    expect(params.showSpectatorPasswordProtected).toBe(true);
    expect(params.showOnlyIfSpectatorsCanChat).toBe(true);
    expect(params.showOnlyIfSpectatorsCanSeeHands).toBe(true);
  });
});
