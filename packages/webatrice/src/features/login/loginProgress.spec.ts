import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { deriveLoginProgress, type LoginProgressInput } from './loginProgress';

const { StatusEnum } = WebsocketTypes;

const base: LoginProgressInput = {
  hasServer: true,
  testConnectionStatus: 'success',
  connectionState: StatusEnum.DISCONNECTED,
  submitting: false,
  failed: false,
};

const stepStates = (input: Partial<LoginProgressInput>) =>
  deriveLoginProgress({ ...base, ...input }).steps.map((s) => `${s.id}:${s.state}`);

describe('deriveLoginProgress', () => {
  test('is ready to sign in once the server test passes', () => {
    const progress = deriveLoginProgress(base);
    expect(progress.phase).toBe('ready');
    expect(progress.canSubmit).toBe(true);
    expect(progress.busy).toBe(false);
    expect(stepStates({})).toEqual(['server:done', 'signIn:pending', 'lobby:pending']);
  });

  test('asks for a server when none is selected', () => {
    const progress = deriveLoginProgress({ ...base, hasServer: false });
    expect(progress.phase).toBe('noServer');
    expect(progress.canSubmit).toBe(false);
    expect(progress.steps[0].state).toBe('pending');
  });

  test.each([
    ['testing', 'testing'],
    [null, 'testing'],
    ['failed', 'unreachable'],
  ] as const)('test-connection status %s gives phase %s and blocks sign-in', (status, phase) => {
    const progress = deriveLoginProgress({ ...base, testConnectionStatus: status });
    expect(progress.phase).toBe(phase);
    expect(progress.canSubmit).toBe(false);
  });

  test('marks the server step failed when the test fails', () => {
    expect(stepStates({ testConnectionStatus: 'failed' })).toEqual(['server:failed', 'signIn:pending', 'lobby:pending']);
  });

  test('shows connecting from the moment the form is submitted', () => {
    const progress = deriveLoginProgress({ ...base, submitting: true });
    expect(progress.phase).toBe('connecting');
    expect(progress.canSubmit).toBe(false);
    expect(progress.busy).toBe(true);
    expect(stepStates({ submitting: true })).toEqual(['server:done', 'signIn:current', 'lobby:pending']);
  });

  test.each([
    [StatusEnum.CONNECTING, 'connecting'],
    [StatusEnum.CONNECTED, 'connecting'],
    [StatusEnum.LOGGING_IN, 'signingIn'],
    [StatusEnum.LOGGED_IN, 'entering'],
  ])('connection state %s gives phase %s', (state, phase) => {
    expect(deriveLoginProgress({ ...base, connectionState: state }).phase).toBe(phase);
  });

  test('a live session wins over a stale test status', () => {
    const progress = deriveLoginProgress({ ...base, testConnectionStatus: 'testing', connectionState: StatusEnum.LOGGING_IN });
    expect(progress.phase).toBe('signingIn');
  });

  test('marks the lobby step current once logged in', () => {
    expect(stepStates({ connectionState: StatusEnum.LOGGED_IN })).toEqual(['server:done', 'signIn:done', 'lobby:current']);
  });

  test('marks sign-in failed after a rejected attempt while the server stays reachable', () => {
    const progress = deriveLoginProgress({ ...base, failed: true });
    expect(progress.canSubmit).toBe(true);
    expect(stepStates({ failed: true })).toEqual(['server:done', 'signIn:failed', 'lobby:pending']);
  });
});
