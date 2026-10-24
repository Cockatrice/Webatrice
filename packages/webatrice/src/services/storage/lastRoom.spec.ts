import { loadPersistedLastRoomId, persistLastRoomId } from './lastRoom';

describe('lastRoom', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('has no room before one is saved', () => {
    expect(loadPersistedLastRoomId('Server::alice')).toBeNull();
  });

  it('returns the last room saved', () => {
    persistLastRoomId('Server::alice', 1);
    persistLastRoomId('Server::alice', 4);

    expect(loadPersistedLastRoomId('Server::alice')).toBe(4);
  });

  it('returns room 0, the first room a server configures', () => {
    persistLastRoomId('Server::alice', 0);

    expect(loadPersistedLastRoomId('Server::alice')).toBe(0);
  });

  it('keeps the room to the server and account that opened it', () => {
    persistLastRoomId('Server::alice', 4);

    expect(loadPersistedLastRoomId('Server::bob')).toBeNull();
    expect(loadPersistedLastRoomId('Other::alice')).toBeNull();
  });

  it.each(['', 'abc', '4', '{"owner":"Server::alice","roomId":-1}', '{"owner":"Server::alice","roomId":1.5}', '{"roomId":4}'])(
    'ignores a stored value of %j',
    (value) => {
      window.localStorage.setItem('webatrice.lastRoom', value);

      expect(loadPersistedLastRoomId('Server::alice')).toBeNull();
    },
  );

  it('neither throws nor restores when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(() => persistLastRoomId('Server::alice', 2)).not.toThrow();
    expect(loadPersistedLastRoomId('Server::alice')).toBeNull();
  });
});
