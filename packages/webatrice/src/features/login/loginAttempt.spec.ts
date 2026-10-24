import { act, renderHook } from '@testing-library/react';

import { attemptFailedFor, loginAttempt, useLoginAttemptFailed } from './loginAttempt';

beforeEach(() => {
  loginAttempt.reset();
});

describe('loginAttempt', () => {
  test('marks a failure only for an attempt in flight', () => {
    loginAttempt.failed();
    expect(loginAttempt.get().failed).toBe(false);

    loginAttempt.started('host:1');
    loginAttempt.failed();
    expect(loginAttempt.get()).toEqual({ target: 'host:1', pending: false, failed: true });
  });

  test('a new attempt clears the previous failure', () => {
    loginAttempt.started('host:1');
    loginAttempt.failed();
    loginAttempt.started('host:1');
    expect(loginAttempt.get().failed).toBe(false);
  });

  test('a success clears everything', () => {
    loginAttempt.started('host:1');
    loginAttempt.succeeded();
    loginAttempt.failed();
    expect(loginAttempt.get().failed).toBe(false);
  });

  test('a failure belongs to the server it was made against', () => {
    loginAttempt.started('host:1');
    loginAttempt.failed();
    expect(attemptFailedFor(loginAttempt.get(), 'host:1')).toBe(true);
    expect(attemptFailedFor(loginAttempt.get(), 'other:2')).toBe(false);
    expect(attemptFailedFor(loginAttempt.get(), null)).toBe(false);
  });

  test('the hook follows the shared attempt across remounts', () => {
    const first = renderHook(() => useLoginAttemptFailed('host:1'));
    act(() => {
      loginAttempt.started('host:1');
      loginAttempt.failed();
    });
    expect(first.result.current).toBe(true);
    first.unmount();

    const second = renderHook(() => useLoginAttemptFailed('host:1'));
    expect(second.result.current).toBe(true);
  });
});
