import { act, fireEvent, screen } from '@testing-library/react';

import { renderWithProviders, connectedState } from '../../__test-utils__';
import { shortcuts } from '../../store';
import Settings from './Settings';

describe('Settings', () => {
  it('renders the shortcuts tab', () => {
    renderWithProviders(<Settings />, { preloadedState: connectedState });

    expect(screen.getByRole('tab', { name: /Settings\.tab\.shortcuts/ })).toBeInTheDocument();
  });

  it('shows the shortcuts tab panel by default', () => {
    renderWithProviders(<Settings />, { preloadedState: connectedState });

    const panel = document.getElementById('settings-tabpanel-0');
    expect(panel).not.toBeNull();
    expect(panel).not.toHaveAttribute('hidden');
  });

  it('exposes the Settings.title as the aria-label on the tab list', () => {
    renderWithProviders(<Settings />, { preloadedState: connectedState });

    expect(screen.getByRole('tablist', { name: /Settings\.title/ })).toBeInTheDocument();
  });

  it('renders all default-binding accordion groups inside the shortcuts panel', () => {
    renderWithProviders(<Settings />, { preloadedState: connectedState });

    expect(screen.getByText(/ShortcutsTab\.group\.global/)).toBeInTheDocument();
    expect(screen.getByText(/ShortcutsTab\.group\.game$/)).toBeInTheDocument();
    expect(screen.getByText(/ShortcutsTab\.group\.gamePhases/)).toBeInTheDocument();
    expect(screen.getByText(/ShortcutsTab\.group\.deckEditor/)).toBeInTheDocument();
    expect(screen.getByText(/ShortcutsTab\.group\.room/)).toBeInTheDocument();
  });

  it('filters the rendered shortcuts when the search box is typed into', async () => {
    renderWithProviders(<Settings />, { preloadedState: connectedState });

    expect(screen.getByText(/ShortcutsTab\.action\.deck\.save/)).toBeInTheDocument();
    expect(screen.getByText(/ShortcutsTab\.action\.app\.openSettings/)).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/ShortcutsTab\.search/);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'deck.save' } });
    });

    expect(screen.getByText(/ShortcutsTab\.action\.deck\.save/)).toBeInTheDocument();
    expect(screen.queryByText(/ShortcutsTab\.action\.app\.openSettings/)).not.toBeInTheDocument();
  });

  it('shows the no-results message when the search filters everything out', async () => {
    renderWithProviders(<Settings />, { preloadedState: connectedState });

    const searchInput = screen.getByLabelText(/ShortcutsTab\.search/);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: '___no_such_shortcut___' } });
    });

    expect(screen.getByText(/ShortcutsTab\.noResults/)).toBeInTheDocument();
  });

  it('dispatching setOverride persists into the shortcuts slice (setting change → store update)', () => {
    const { store } = renderWithProviders(<Settings />, { preloadedState: connectedState });

    expect(store.getState().shortcuts.overrides['game.drawCard']).toBeUndefined();

    act(() => {
      store.dispatch(
        shortcuts.Actions.setOverride({ actionId: 'game.drawCard', sequences: ['Ctrl+KeyZ'] }),
      );
    });

    expect(store.getState().shortcuts.overrides['game.drawCard']).toEqual(['Ctrl+KeyZ']);
  });

  it('dispatching resetAction removes a single override (settings reset)', () => {
    const { store } = renderWithProviders(<Settings />, { preloadedState: connectedState });

    act(() => {
      store.dispatch(
        shortcuts.Actions.setOverride({ actionId: 'deck.save', sequences: ['Ctrl+Shift+KeyS'] }),
      );
    });
    expect(store.getState().shortcuts.overrides['deck.save']).toEqual(['Ctrl+Shift+KeyS']);

    act(() => {
      store.dispatch(shortcuts.Actions.resetAction({ actionId: 'deck.save' }));
    });
    expect(store.getState().shortcuts.overrides['deck.save']).toBeUndefined();
  });

  it('dispatching resetAll clears every override at once', () => {
    const { store } = renderWithProviders(<Settings />, { preloadedState: connectedState });

    act(() => {
      store.dispatch(
        shortcuts.Actions.setOverride({ actionId: 'deck.new', sequences: ['Ctrl+KeyM'] }),
      );
      store.dispatch(
        shortcuts.Actions.setOverride({ actionId: 'deck.load', sequences: ['Ctrl+KeyL'] }),
      );
    });
    expect(Object.keys(store.getState().shortcuts.overrides)).toHaveLength(2);

    act(() => {
      store.dispatch(shortcuts.Actions.resetAll());
    });
    expect(store.getState().shortcuts.overrides).toEqual({});
  });
});
