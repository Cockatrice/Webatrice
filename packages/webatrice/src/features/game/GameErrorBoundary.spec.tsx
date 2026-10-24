import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders, connectedState } from '../../__test-utils__';
import GameErrorBoundary from './GameErrorBoundary';

const crash = { on: true };

function Board() {
  if (crash.on) {
    throw new Error('board exploded');
  }
  return <div>board</div>;
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  crash.on = true;
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('GameErrorBoundary', () => {
  it('contains a board render crash in a recoverable panel and logs it', () => {
    renderWithProviders(<GameErrorBoundary gameId={1}><Board /></GameErrorBoundary>, { preloadedState: connectedState });
    expect(screen.getByRole('alert')).toHaveTextContent('GameErrorBoundary.title');
    expect(consoleError).toHaveBeenCalledWith(
      '[ErrorBoundary:game-board] render failed:',
      expect.objectContaining({ message: 'board exploded' }),
      expect.any(String),
    );
  });

  it('reloads the board from live state', () => {
    renderWithProviders(<GameErrorBoundary gameId={1}><Board /></GameErrorBoundary>, { preloadedState: connectedState });
    crash.on = false;
    fireEvent.click(screen.getByRole('button', { name: 'GameErrorBoundary.retry' }));
    expect(screen.getByText('board')).toBeInTheDocument();
  });
});
