import { screen, fireEvent, within } from '@testing-library/react';
import { act } from 'react';

import { renderWithProviders, connectedState, makeUser, createMockWebClient } from '../../__test-utils__';
import UserRows from './UserRows';

const mockWebClient = createMockWebClient();

vi.mock('@cockatrice/datatrice/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cockatrice/datatrice/react')>();
  return { ...actual, useWebClient: vi.fn(() => mockWebClient) };
});

vi.mock('@app/images', () => ({
  Images: { Countries: { us: 'us.png' } },
}));

// react-window sizes its viewport via ResizeObserver, which the jsdom harness
// stubs to a no-op (zero height → zero rows). Install an emitting observer, as
// VirtualList.spec does, so rows actually mount — otherwise this test would
// pass vacuously (no rows, no menu, nothing to mis-target).
type RoCallback = (entries: { contentRect: { height: number; width: number }; target: Element }[]) => void;
interface RoHandle { callback: RoCallback; targets: Set<Element>; }
let observers: RoHandle[] = [];

function mountRows(container: HTMLElement, height = 200, width = 240): void {
  const list = container.querySelector('.virtual-list__list');
  if (!list) {
    throw new Error('virtual-list__list element not found');
  }
  for (const handle of observers) {
    if (handle.targets.has(list)) {
      act(() => {
        handle.callback([{ contentRect: { height, width }, target: list }]);
      });
    }
  }
}

function openMenuFor(name: string): void {
  const details = screen.getByText(name).closest('.user-display__details');
  if (!details) {
    throw new Error(`user-display row for "${name}" not found`);
  }
  fireEvent.contextMenu(details);
}

describe('UserRows', () => {
  let originalRo: typeof globalThis.ResizeObserver;

  beforeEach(() => {
    vi.mocked(mockWebClient.request.session.addToBuddyList).mockClear();
    originalRo = globalThis.ResizeObserver;
    observers = [];
    globalThis.ResizeObserver = class {
      private handle: RoHandle;
      constructor(callback: RoCallback) {
        this.handle = { callback, targets: new Set() };
        observers.push(this.handle);
      }
      observe(target: Element) {
        this.handle.targets.add(target);
      }
      unobserve(target: Element) {
        this.handle.targets.delete(target);
      }
      disconnect() {
        this.handle.targets.clear();
      }
    } as unknown as typeof globalThis.ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalRo;
    observers = [];
  });

  it('opens a user\'s action menu and sends the action for that user', () => {
    const { container } = renderWithProviders(
      <UserRows users={[makeUser({ name: 'alice', country: 'us' }), makeUser({ name: 'bob', country: 'us' })]} empty="" />,
      { preloadedState: connectedState },
    );
    mountRows(container);

    openMenuFor('alice');
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: /Add to Buddy List/i }));

    expect(mockWebClient.request.session.addToBuddyList).toHaveBeenCalledWith('alice');
  });

  it('never retargets an open menu to the user that slides into its row on roster churn', () => {
    // Regression guard for the name-keyed rows (not slot index) — see
    // webatrice.instructions.md § Virtualized lists.
    const { container, rerender } = renderWithProviders(
      <UserRows users={[makeUser({ name: 'alice', country: 'us' }), makeUser({ name: 'bob', country: 'us' })]} empty="" />,
      { preloadedState: connectedState },
    );
    mountRows(container);

    openMenuFor('alice');
    expect(screen.getByRole('menu')).toBeInTheDocument();

    rerender(<UserRows users={[makeUser({ name: 'carol', country: 'us' }), makeUser({ name: 'bob', country: 'us' })]} empty="" />);

    // The menu must be torn down (or still belong to alice); the action must
    // never fire for carol, who took alice's slot.
    const menu = screen.queryByRole('menu');
    if (menu) {
      fireEvent.click(within(menu).getByRole('menuitem', { name: /Add to Buddy List/i }));
    }
    expect(mockWebClient.request.session.addToBuddyList).not.toHaveBeenCalledWith('carol');
  });
});
