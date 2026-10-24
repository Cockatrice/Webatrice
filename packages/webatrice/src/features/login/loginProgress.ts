import type { TestConnectionStatus } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

export type LoginPhase = 'noServer' | 'testing' | 'unreachable' | 'ready' | 'connecting' | 'signingIn' | 'entering';
export type LoginStepId = 'server' | 'signIn' | 'lobby';
export type LoginStepState = 'pending' | 'current' | 'done' | 'failed';

export interface LoginStep {
  id: LoginStepId;
  state: LoginStepState;
}

export interface LoginProgress {
  phase: LoginPhase;
  canSubmit: boolean;
  busy: boolean;
  steps: LoginStep[];
}

export interface LoginProgressInput {
  hasServer: boolean;
  testConnectionStatus: TestConnectionStatus;
  connectionState: WebsocketTypes.StatusEnum | undefined;
  submitting: boolean;
  failed: boolean;
}

const { StatusEnum } = WebsocketTypes;

function phaseOf({ hasServer, testConnectionStatus, connectionState, submitting }: LoginProgressInput): LoginPhase {
  if (!hasServer) {
    return 'noServer';
  }
  if (connectionState === StatusEnum.LOGGED_IN) {
    return 'entering';
  }
  if (connectionState === StatusEnum.LOGGING_IN) {
    return 'signingIn';
  }
  if (submitting || connectionState === StatusEnum.CONNECTING || connectionState === StatusEnum.CONNECTED) {
    return 'connecting';
  }
  if (testConnectionStatus === 'success') {
    return 'ready';
  }
  if (testConnectionStatus === 'failed') {
    return 'unreachable';
  }
  return 'testing';
}

function serverStep(phase: LoginPhase): LoginStepState {
  switch (phase) {
    case 'noServer':
      return 'pending';
    case 'testing':
      return 'current';
    case 'unreachable':
      return 'failed';
    default:
      return 'done';
  }
}

function signInStep(phase: LoginPhase, failed: boolean): LoginStepState {
  switch (phase) {
    case 'connecting':
    case 'signingIn':
      return 'current';
    case 'entering':
      return 'done';
    case 'ready':
      return failed ? 'failed' : 'pending';
    default:
      return 'pending';
  }
}

export function deriveLoginProgress(input: LoginProgressInput): LoginProgress {
  const phase = phaseOf(input);
  return {
    phase,
    canSubmit: phase === 'ready',
    busy: phase === 'testing' || phase === 'connecting' || phase === 'signingIn' || phase === 'entering',
    steps: [
      { id: 'server', state: serverStep(phase) },
      { id: 'signIn', state: signInStep(phase, input.failed) },
      { id: 'lobby', state: phase === 'entering' ? 'current' : 'pending' },
    ],
  };
}
