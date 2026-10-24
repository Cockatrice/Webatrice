import { renderHook } from '@testing-library/react';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { useCommandFailureMessage } from './useCommandFailureMessage';

describe('useCommandFailureMessage', () => {
  it.each([
    [WebsocketTypes.CommandFailure.NotSent, 'CommandFailure.notSent'],
    [WebsocketTypes.CommandFailure.Timeout, 'CommandFailure.timeout'],
    [WebsocketTypes.CommandFailure.Disconnected, 'CommandFailure.disconnected'],
  ])('explains a %s failure with its transport reason', (failure, key) => {
    const { result } = renderHook(() => useCommandFailureMessage());
    expect(result.current(failure, 'Server error.')).toBe(key);
  });

  it('uses the flow\'s own message for a server rejection', () => {
    const { result } = renderHook(() => useCommandFailureMessage());
    expect(result.current(undefined, 'Server error.')).toBe('Server error.');
  });
});
