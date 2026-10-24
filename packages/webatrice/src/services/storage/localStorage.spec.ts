import { readLocalStorage, writeLocalStorage } from './localStorage';

describe('localStorage helpers', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips a value', () => {
    writeLocalStorage('k', 'v');

    expect(readLocalStorage('k')).toBe('v');
    expect(readLocalStorage('missing')).toBeNull();
  });

  it('drops a write the browser refuses', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(() => writeLocalStorage('k', 'v')).not.toThrow();
    expect(readLocalStorage('k')).toBeNull();
  });

  it('reads nothing when storage is blocked', () => {
    window.localStorage.setItem('k', 'v');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(readLocalStorage('k')).toBeNull();
  });
});
