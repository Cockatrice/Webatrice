import { clearHomeSnapshot, HOME_SNAPSHOT_KEY, homePreview, loadHomeSnapshot, saveHomeSnapshot, type HomeSnapshot } from './homeSnapshot';

const snapshot: HomeSnapshot = {
  version: 1, host: 'test.example:4747', userName: 'joe', serverName: 'Test server',
  onlineCount: 12, gamesRunning: 3,
  rooms: [{ id: 1, name: 'Cached room', games: 3, people: 12 }],
  usualRoomId: 1, openGames: [{ id: 7, name: 'Cached game', players: 1, maxPlayers: 2 }],
  buddiesOnline: 2, buddyCount: 5,
};

afterEach(() => {
  localStorage.clear();
  homePreview.set(null);
});

it('restores only the matching host and account', () => {
  saveHomeSnapshot(snapshot);
  expect(loadHomeSnapshot(snapshot.host, snapshot.userName)).toEqual(snapshot);
  expect(loadHomeSnapshot('other.example:4747', 'joe')).toBeNull();
  expect(loadHomeSnapshot('test.example:4748', 'joe')).toBeNull();
  expect(loadHomeSnapshot(snapshot.host, 'jane')).toBeNull();
  saveHomeSnapshot({ ...snapshot, userName: 'jane', serverName: 'Jane session' });
  saveHomeSnapshot({ ...snapshot, host: 'other.example:4747', serverName: 'Other host' });
  expect(loadHomeSnapshot(snapshot.host, 'joe')).toEqual(snapshot);
  expect(loadHomeSnapshot(snapshot.host, 'jane')?.serverName).toBe('Jane session');
  expect(loadHomeSnapshot('other.example:4747', 'joe')?.serverName).toBe('Other host');
});

it.each(['{', '{}', JSON.stringify({ ...snapshot, version: 2 }), JSON.stringify({ ...snapshot, rooms: [null] })])(
  'ignores corrupt or obsolete persisted data: %s', raw => {
    localStorage.setItem(HOME_SNAPSHOT_KEY, raw);
    expect(loadHomeSnapshot(snapshot.host, snapshot.userName)).toBeNull();
  },
);

it('drops disk and displayed data on clear', () => {
  saveHomeSnapshot(snapshot);
  homePreview.set(snapshot);
  clearHomeSnapshot();
  expect(loadHomeSnapshot(snapshot.host, snapshot.userName)).toBeNull();
  expect(homePreview.get()).toBeNull();
});

it('tolerates unavailable storage', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  expect(() => saveHomeSnapshot(snapshot)).not.toThrow();
  expect(() => clearHomeSnapshot()).not.toThrow();
  expect(loadHomeSnapshot(snapshot.host, snapshot.userName)).toBeNull();
});

it('bounds the snapshot and strips unrelated fields', () => {
  saveHomeSnapshot({ ...snapshot, password: 'not persisted', chat: 'not persisted' } as HomeSnapshot);
  expect(localStorage.getItem(HOME_SNAPSHOT_KEY)).not.toContain('not persisted');
  localStorage.setItem(HOME_SNAPSHOT_KEY, ' '.repeat(64_001));
  expect(loadHomeSnapshot(snapshot.host, snapshot.userName)).toBeNull();
});
