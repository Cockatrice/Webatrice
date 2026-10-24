import { connectedState, disconnectedState, makeUser, renderWithProviders } from '../../../__test-utils__';

import { useIdentityChange } from './useIdentityChange';

const OWNER_KEY = 'webatrice.stickyTabs.owner';
const IDENTITY = 'Test Server::testUser';

function Probe({ onChange }: { onChange: () => void }) {
  useIdentityChange(onChange);
  return null;
}

function render(onChange: () => void, preloadedState = connectedState) {
  return renderWithProviders(<Probe onChange={onChange} />, { preloadedState });
}

describe('useIdentityChange', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('reports a sign-in as someone else, and records the new owner', () => {
    window.localStorage.setItem(OWNER_KEY, 'Other Server::someoneElse');
    const onChange = vi.fn();

    render(onChange);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(OWNER_KEY)).toBe(IDENTITY);
  });

  it('reports nothing on the first sign-in or a repeat of the same one', () => {
    const onChange = vi.fn();

    render(onChange).unmount();
    render(onChange);

    expect(onChange).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(OWNER_KEY)).toBe(IDENTITY);
  });

  it('waits for both a server name and a user', () => {
    window.localStorage.setItem(OWNER_KEY, 'Other Server::someoneElse');
    const onChange = vi.fn();
    const noUser = { ...connectedState, server: { ...(connectedState.server as any), user: null } };

    render(onChange, disconnectedState).unmount();
    render(onChange, noUser);

    expect(onChange).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(OWNER_KEY)).toBe('Other Server::someoneElse');
  });

  it('runs once per identity, not on every render with a new callback', () => {
    window.localStorage.setItem(OWNER_KEY, 'Other Server::someoneElse');
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(first);

    rerender(<Probe onChange={second} />);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('reports a later sign-in as another user of the same server', () => {
    const onChange = vi.fn();
    render(onChange).unmount();
    const otherUser = { ...connectedState, server: { ...(connectedState.server as any), user: makeUser({ name: 'alice' }) } };

    render(onChange, otherUser);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(OWNER_KEY)).toBe('Test Server::alice');
  });

  it('reports nothing, and does not throw, when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const onChange = vi.fn();

    expect(() => render(onChange)).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
