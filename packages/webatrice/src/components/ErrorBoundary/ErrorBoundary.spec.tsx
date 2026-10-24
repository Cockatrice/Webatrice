import { fireEvent, render, screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';

import { renderWithProviders, disconnectedState } from '../../__test-utils__';
import ErrorBoundary from './ErrorBoundary';
import RouteErrorBoundary from './RouteErrorBoundary';

const crash = { on: true };

function Thrower() {
  if (crash.on) {
    throw new Error('boom');
  }
  return <div>recovered</div>;
}

function LocationProbe() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  crash.on = true;
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    crash.on = false;
    render(<ErrorBoundary name="t" fallback={() => 'fallback'}><Thrower /></ErrorBoundary>);
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('renders the fallback for a render crash and logs it under the boundary name', () => {
    render(<ErrorBoundary name="board" fallback={({ error }) => `caught: ${error.message}`}><Thrower /></ErrorBoundary>);
    expect(screen.getByText('caught: boom')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      '[ErrorBoundary:board] render failed:',
      expect.objectContaining({ message: 'boom' }),
      expect.any(String),
    );
  });

  it('re-renders the children when the fallback resets', () => {
    render(
      <ErrorBoundary name="t" fallback={({ reset }) => <button onClick={reset}>retry</button>}>
        <Thrower />
      </ErrorBoundary>,
    );
    crash.on = false;
    fireEvent.click(screen.getByText('retry'));
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('clears the error when resetKey changes', () => {
    const { rerender } = render(<ErrorBoundary name="t" resetKey={1} fallback={() => 'fallback'}><Thrower /></ErrorBoundary>);
    expect(screen.getByText('fallback')).toBeInTheDocument();
    crash.on = false;
    rerender(<ErrorBoundary name="t" resetKey={2} fallback={() => 'fallback'}><Thrower /></ErrorBoundary>);
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });
});

describe('RouteErrorBoundary', () => {
  function renderRoutes() {
    return renderWithProviders(
      <>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/decks" element={<Thrower />} />
            <Route path="/server" element={<div>lobby</div>} />
          </Routes>
        </RouteErrorBoundary>
        <LocationProbe />
      </>,
      { preloadedState: disconnectedState, route: '/decks' },
    );
  }

  it('shows a recovery panel instead of white-screening the app', () => {
    renderRoutes();
    expect(screen.getByRole('alert')).toHaveTextContent('ErrorFallback.route.title');
    expect(consoleError).toHaveBeenCalledWith('[ErrorBoundary:route] render failed:', expect.any(Error), expect.any(String));
  });

  it('retries rendering the page in place', () => {
    renderRoutes();
    crash.on = false;
    fireEvent.click(screen.getByRole('button', { name: 'ErrorFallback.route.retry' }));
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('returns to the lobby', () => {
    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'ErrorFallback.returnToLobby' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/server');
    expect(screen.getByText('lobby')).toBeInTheDocument();
  });
});

it('recovers when Return to lobby is clicked from an already-crashed lobby', () => {
  renderWithProviders(<RouteErrorBoundary><Thrower /></RouteErrorBoundary>, {
    preloadedState: disconnectedState, route: '/server',
  });
  crash.on = false;
  fireEvent.click(screen.getByRole('button', { name: 'ErrorFallback.returnToLobby' }));
  expect(screen.getByText('recovered')).toBeInTheDocument();
});
