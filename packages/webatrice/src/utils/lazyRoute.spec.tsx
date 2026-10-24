import { Suspense } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../__test-utils__';
import { testI18n } from '../__test-utils__/renderWithProviders';
import RouteErrorBoundary from '../components/ErrorBoundary/RouteErrorBoundary';
import { lazyRoute, reloadRoute, RouteChunkError } from './lazyRoute';
import translations from '../components/ErrorBoundary/ErrorBoundary.i18n.json';

vi.mock('./lazyRoute', async (importOriginal) => ({
  ...await importOriginal<typeof import('./lazyRoute')>(),
  reloadRoute: vi.fn(),
}));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  testI18n.addResourceBundle('en-US', 'translation', translations, true, true);
});

it('shares a successful prefetch with navigation without importing again', async () => {
  const load = vi.fn().mockResolvedValue({ default: () => <div>ready</div> });
  const { Component, isLoaded, preload } = lazyRoute(load);
  expect(isLoaded()).toBe(false);
  await Promise.all([preload(), preload()]);
  expect(isLoaded()).toBe(true);
  await preload();
  renderWithProviders(<Suspense fallback="waiting"><Component /></Suspense>);
  expect(await screen.findByText('ready')).toBeInTheDocument();
  expect(load).toHaveBeenCalledTimes(1);
});

it('retries a failed background prefetch when the user navigates', async () => {
  const load = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
    .mockResolvedValueOnce({ default: () => <div>ready</div> });
  const { Component, isLoaded, preload } = lazyRoute(load);
  await expect(preload()).rejects.toBeInstanceOf(RouteChunkError);
  expect(isLoaded()).toBe(false);
  renderWithProviders(<Suspense fallback="waiting"><Component /></Suspense>);
  expect(await screen.findByText('ready')).toBeInTheDocument();
  expect(load).toHaveBeenCalledTimes(2);
});

it('shows the new-version message on import failure and reloads only when requested', async () => {
  const { Component } = lazyRoute(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')));
  renderWithProviders(
    <RouteErrorBoundary><Suspense fallback="waiting"><Component /></Suspense></RouteErrorBoundary>,
    { route: '/deck/42' },
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('A new version is available');
  expect(screen.getByRole('alert')).toHaveTextContent('Reload to get the latest version of Webatrice');
  expect(reloadRoute).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
  expect(reloadRoute).toHaveBeenCalledTimes(1);
});

it('can leave a failed route for Home without reloading', async () => {
  const { Component } = lazyRoute(() => Promise.reject(new Error('missing chunk')));
  renderWithProviders(
    <RouteErrorBoundary>
      <Suspense fallback="waiting">
        <Routes>
          <Route path="/deck/42" element={<Component />} />
          <Route path="/server" element={<div>Home</div>} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>,
    { route: '/deck/42' },
  );
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Return to lobby' }));
  expect(await screen.findByText('Home')).toBeInTheDocument();
});

it('keeps ordinary render errors on the existing retry path', async () => {
  function BrokenPage(): never {
    throw new Error('render error');
  }
  const { Component } = lazyRoute(() => Promise.resolve({ default: BrokenPage }));
  await act(async () => {
    renderWithProviders(<RouteErrorBoundary><Suspense fallback="waiting"><Component /></Suspense></RouteErrorBoundary>);
  });
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
});
