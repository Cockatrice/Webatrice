import { act, renderHook } from '@testing-library/react';
import { endSession } from '@app/services/session';
import { clearGameLinkRequest, requestGameLinkJoin, useGameLinkRequest } from './gameLinkRequests';

afterEach(() => act(clearGameLinkRequest));

it('clears a queued game link at every session end, including with no subscribers', () => {
  requestGameLinkJoin('old-session');
  endSession();
  const { result } = renderHook(useGameLinkRequest);
  expect(result.current).toBeNull();
  act(() => requestGameLinkJoin('new-session'));
  expect(result.current?.url).toBe('new-session');
  act(endSession);
  expect(result.current).toBeNull();
});
