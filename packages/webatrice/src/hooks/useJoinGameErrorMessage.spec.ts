import { renderHook } from '@testing-library/react';
import { Response_ResponseCode as Code } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { useJoinGameErrorMessage } from './useJoinGameErrorMessage';

it.each([
  [Code.RespNotInRoom, 'notInRoom'], [Code.RespNameNotFound, 'notFound'],
  [Code.RespGameFull, 'full'], [Code.RespWrongPassword, 'wrongPassword'],
  [Code.RespSpectatorsNotAllowed, 'noSpectators'], [Code.RespOnlyBuddies, 'buddiesOnly'],
  [Code.RespUserLevelTooLow, 'registeredOnly'], [Code.RespInIgnoreList, 'ignored'],
])('translates response %s in the UI even if legacy text was supplied', (code, key) => {
  const { result } = renderHook(() => useJoinGameErrorMessage({ code, message: 'legacy English' }));
  expect(result.current).toBe(`JoinGameError.${key}`);
});

it.each([
  [WebsocketTypes.CommandFailure.NotSent, 'notSent'],
  [WebsocketTypes.CommandFailure.Timeout, 'timeout'],
  [WebsocketTypes.CommandFailure.Disconnected, 'disconnected'],
])('translates transport failure %s', (failure, key) => {
  const { result } = renderHook(() => useJoinGameErrorMessage({ code: Code.RespNotConnected, failure }));
  expect(result.current).toBe(`CommandFailure.${key}`);
});

it('handles no error and legacy unknown-code messages', () => {
  expect(renderHook(() => useJoinGameErrorMessage(null)).result.current).toBe('');
  expect(renderHook(() => useJoinGameErrorMessage({ code: 999, message: 'legacy' })).result.current).toBe('legacy');
  expect(renderHook(() => useJoinGameErrorMessage({ code: 999 })).result.current).toBe('JoinGameError.failed');
});
