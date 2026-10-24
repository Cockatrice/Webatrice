import { endSession, onSessionEnd, sessionGeneration } from './index';

it('advances the session generation once per session end, including re-entrant ends', () => {
  const before = sessionGeneration();
  endSession();
  expect(sessionGeneration()).toBe(before + 1);
  const unsubscribe = onSessionEnd(() => endSession());
  endSession();
  unsubscribe();
  expect(sessionGeneration()).toBe(before + 2);
});

it('supports independent registrations, repeated boundaries and unsubscribe', () => {
  const handler = vi.fn();
  const first = onSessionEnd(handler);
  const second = onSessionEnd(handler);
  first();
  endSession();
  endSession();
  expect(handler).toHaveBeenCalledTimes(2);
  second();
  endSession();
  expect(handler).toHaveBeenCalledTimes(2);
});

it('isolates throwing and re-entrant handlers and defers new registrations', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const late = vi.fn();
  const last = vi.fn();
  let unsubscribeLate = () => {};
  const unsubscribeFirst = onSessionEnd(() => {
    unsubscribeLate = onSessionEnd(late);
    endSession();
    throw new Error('cleanup failed');
  });
  const unsubscribeLast = onSessionEnd(last);
  try {
    expect(() => endSession()).not.toThrow();
    expect(last).toHaveBeenCalledTimes(1);
    expect(late).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    endSession();
    expect(late).toHaveBeenCalledTimes(1);
  } finally {
    unsubscribeFirst();
    unsubscribeLast();
    unsubscribeLate();
    log.mockRestore();
  }
});
