import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { server } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag as Flag } from '@cockatrice/sockatrice/generated';

import { rootReducerMap, type RootState } from '@app/store';
import { connectedState, makeUser } from '../../__test-utils__';
import { lookupUserAvatar, UserAvatarService } from './UserAvatarService';

const PNG = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

function setup(options: { batchSize?: number; intervalMs?: number } = {}) {
  const store = configureStore({
    reducer: combineReducers(rootReducerMap),
    preloadedState: {
      ...connectedState,
      server: {
        ...connectedState.server!,
        user: makeUser({ name: 'me', avatarBmp: PNG }),
        users: {
          me: makeUser({ name: 'me' }),
          guest: makeUser({ name: 'guest', userLevel: 0 }),
          alice: makeUser({ name: 'alice', userLevel: Flag.IsRegistered }),
        },
      },
    } as RootState,
  });
  const request = vi.fn();
  const service = new UserAvatarService(store, request, options);
  const respond = (name: string, avatarBmp?: Uint8Array) =>
    store.dispatch(server.Actions.getUserInfo({ userInfo: makeUser({ name, avatarBmp }) }));
  return { store, request, service, respond };
}

let created: string[];
let revoked: string[];

beforeEach(() => {
  vi.useFakeTimers();
  created = [];
  revoked = [];
  let next = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    next += 1;
    const url = `blob:avatar-${next}`;
    created.push(url);
    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    revoked.push(url);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('lookupUserAvatar', () => {
  it('prefers fetched user info, then the own user, then the online list', () => {
    const { store, respond } = setup();
    expect(lookupUserAvatar(store.getState(), 'me')).toEqual({ bmp: PNG, known: true, unregistered: false });
    expect(lookupUserAvatar(store.getState(), 'alice')).toEqual({ bmp: undefined, known: false, unregistered: false });
    expect(lookupUserAvatar(store.getState(), 'guest').unregistered).toBe(true);
    expect(lookupUserAvatar(store.getState(), 'offline')).toEqual({ bmp: undefined, known: false, unregistered: false });
    respond('alice');
    expect(lookupUserAvatar(store.getState(), 'alice')).toEqual({ bmp: undefined, known: true, unregistered: false });
  });
});

describe('UserAvatarService', () => {
  it('requests each unknown user once per session', () => {
    const { service, request, respond } = setup();
    service.want('alice');
    service.want('alice');
    vi.runOnlyPendingTimers();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('alice');
    service.want('alice');
    respond('alice');
    service.want('alice');
    vi.runAllTimers();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('skips users it already knows and users the online list marks unregistered', () => {
    const { service, request, respond } = setup();
    respond('bob', PNG);
    service.want('me');
    service.want('bob');
    service.want('guest');
    service.want('');
    vi.runAllTimers();
    expect(request).not.toHaveBeenCalled();
  });

  it('keeps the pace across bursts even after the queue drains', () => {
    const { service, request } = setup({ batchSize: 6, intervalMs: 250 });
    service.want('a');
    service.want('b');
    vi.advanceTimersByTime(0);
    expect(request).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(10);
    service.want('c');
    service.want('d');
    vi.advanceTimersByTime(0);
    expect(request).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(239);
    expect(request).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    expect(request.mock.calls.map(([name]) => name)).toEqual(['a', 'b', 'c', 'd']);
    vi.advanceTimersByTime(1000);
    service.want('e');
    vi.advanceTimersByTime(0);
    expect(request).toHaveBeenCalledTimes(5);
  });

  it('paces requests in batches', () => {
    const { service, request } = setup({ batchSize: 2, intervalMs: 100 });
    ['a', 'b', 'c', 'd', 'e'].forEach((name) => service.want(name));
    vi.advanceTimersByTime(0);
    expect(request.mock.calls.map(([name]) => name)).toEqual(['a', 'b']);
    vi.advanceTimersByTime(99);
    expect(request).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    expect(request.mock.calls.map(([name]) => name)).toEqual(['a', 'b', 'c', 'd']);
    vi.advanceTimersByTime(100);
    expect(request).toHaveBeenCalledTimes(5);
    expect(service.pendingCount()).toBe(0);
  });

  it('drops a queued request when the user info arrives first', () => {
    const { service, request, respond } = setup({ batchSize: 1, intervalMs: 100 });
    service.want('a');
    service.want('b');
    vi.advanceTimersByTime(0);
    respond('b', PNG);
    vi.advanceTimersByTime(100);
    expect(request.mock.calls.map(([name]) => name)).toEqual(['a']);
  });

  it('reuses one object URL per avatar and makes a new one when the picture changes', () => {
    const { service, respond } = setup();
    expect(service.getSrc('alice')).toBeNull();
    respond('alice', PNG);
    const first = service.getSrc('alice');
    expect(first).toBe('blob:avatar-1');
    respond('alice', new Uint8Array(PNG));
    expect(service.getSrc('alice')).toBe(first);
    respond('alice', new Uint8Array([9, 9]));
    expect(service.getSrc('alice')).toBe('blob:avatar-2');
    expect(created).toHaveLength(2);
  });

  it('revokes a superseded picture shortly after consumers switch to the new one', () => {
    const { service, respond } = setup();
    respond('alice', PNG);
    service.getSrc('alice');
    respond('alice', new Uint8Array([9, 9]));
    service.getSrc('alice');
    expect(revoked).toEqual([]);
    vi.advanceTimersByTime(1000);
    expect(revoked).toEqual(['blob:avatar-1']);
    respond('alice', new Uint8Array([7]));
    service.getSrc('alice');
    vi.advanceTimersByTime(1000);
    expect(revoked).toEqual(['blob:avatar-1', 'blob:avatar-2']);
  });

  it('revokes the picture when the user no longer has one', () => {
    const { service, respond } = setup();
    respond('alice', PNG);
    service.getSrc('alice');
    respond('alice');
    expect(service.getSrc('alice')).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(revoked).toEqual(['blob:avatar-1']);
  });

  it('clears the cache, the queue and the dedupe set on clear', () => {
    const { service, request, respond } = setup({ batchSize: 1, intervalMs: 100 });
    respond('alice', PNG);
    service.getSrc('alice');
    service.getSrc('me');
    service.want('x');
    service.want('y');
    vi.advanceTimersByTime(0);
    service.clear();
    expect(revoked.sort()).toEqual([...created].sort());
    vi.runAllTimers();
    expect(request.mock.calls.map(([name]) => name)).toEqual(['x']);
    service.want('x');
    vi.runAllTimers();
    expect(request.mock.calls.map(([name]) => name)).toEqual(['x', 'x']);
  });

  it('requests only once an observed icon scrolls into view', () => {
    const callbacks: IntersectionObserverCallback[] = [];
    const observe = vi.fn();
    const unobserve = vi.fn();
    vi.stubGlobal('IntersectionObserver', vi.fn(function FakeObserver(this: unknown, cb: IntersectionObserverCallback) {
      callbacks.push(cb);
      return { observe, unobserve, disconnect: vi.fn() };
    }));
    try {
      const { service, request } = setup();
      const element = document.createElement('span');
      const release = service.observe(element, 'alice');
      vi.runAllTimers();
      expect(request).not.toHaveBeenCalled();
      callbacks[0]([{ target: element, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
      vi.runAllTimers();
      expect(request).toHaveBeenCalledWith('alice');
      release();
      expect(unobserve).toHaveBeenCalledWith(element);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
