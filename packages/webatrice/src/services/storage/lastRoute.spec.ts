import { loadPersistedLastRoute, persistLastRoute } from './lastRoute';

describe('lastRoute', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('has no route before one is saved', () => {
    expect(loadPersistedLastRoute()).toBeNull();
  });

  it('returns the last route saved', () => {
    persistLastRoute('/decks');
    persistLastRoute('/settings');

    expect(loadPersistedLastRoute()).toBe('/settings');
    expect(window.localStorage.getItem('webatrice.lastRoute')).toBe('/settings');
  });

  it('neither throws nor restores when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(() => persistLastRoute('/decks')).not.toThrow();
    expect(loadPersistedLastRoute()).toBeNull();
  });
});
