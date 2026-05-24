vi.mock('../../WebClient');

import { WebClient } from '../../WebClient';
import { consumePendingOptions } from '../../utils/connectionState';
import { StatusEnum } from '../../types/StatusEnum';
import { WebSocketConnectReason } from '../../types/ConnectOptions';
import { activateAccount } from './activateAccount';
import { disconnect } from './disconnect';
import { login } from './login';
import { register } from './register';
import { resetPassword } from './resetPassword';
import { resetPasswordChallenge } from './resetPasswordChallenge';
import { resetPasswordRequest } from './resetPasswordRequest';
import { testConnection } from './testConnection';

const HOST = 'h';
const PORT = '4748';

beforeEach(() => {
  // pendingOptions is module-level state that survives vi.clearAllMocks().
  consumePendingOptions();
});

describe.each([
  ['login', login, WebSocketConnectReason.LOGIN, { userName: 'alice', password: 'secret' }],
  ['register', register, WebSocketConnectReason.REGISTER, { userName: 'alice', password: 'p', email: 'e', country: 'us', realName: 'A' }],
  ['activateAccount', activateAccount, WebSocketConnectReason.ACTIVATE_ACCOUNT, { userName: 'alice', token: 't' }],
  ['resetPasswordRequest', resetPasswordRequest, WebSocketConnectReason.PASSWORD_RESET_REQUEST, { userName: 'alice' }],
  ['resetPasswordChallenge', resetPasswordChallenge, WebSocketConnectReason.PASSWORD_RESET_CHALLENGE, { userName: 'alice', email: 'e' }],
  ['resetPassword', resetPassword, WebSocketConnectReason.PASSWORD_RESET, { userName: 'alice', token: 't', newPassword: 'p' }],
] as const)('%s', (_name, method, reason, extras) => {
  const options = { host: HOST, port: PORT, ...extras };

  it('stores pending options merged with the matching reason', () => {
    method(options as never);
    expect(consumePendingOptions()).toEqual({ ...options, reason });
  });

  it('marks status CONNECTING with the "Connecting..." label', () => {
    method(options as never);
    expect(WebClient.instance.response.session.updateStatus).toHaveBeenCalledWith(StatusEnum.CONNECTING, 'Connecting...');
    expect(WebClient.instance.updateStatus).toHaveBeenCalledWith(StatusEnum.CONNECTING);
  });

  it('connects with the supplied host and port', () => {
    method(options as never);
    expect(WebClient.instance.connect).toHaveBeenCalledWith({ host: HOST, port: PORT });
  });
});

describe('testConnection', () => {
  it('calls WebClient.instance.testConnect with host and port', () => {
    testConnection({ host: HOST, port: PORT });
    expect(WebClient.instance.testConnect).toHaveBeenCalledWith({ host: HOST, port: PORT });
  });

  it('does not store pending options', () => {
    testConnection({ host: HOST, port: PORT });
    expect(consumePendingOptions()).toBeNull();
  });

  it('does not update status', () => {
    testConnection({ host: HOST, port: PORT });
    expect(WebClient.instance.response.session.updateStatus).not.toHaveBeenCalled();
    expect(WebClient.instance.updateStatus).not.toHaveBeenCalled();
  });
});

describe('disconnect', () => {
  it('delegates to WebClient.instance.disconnect via the session disconnect command', () => {
    disconnect();
    expect(WebClient.instance.disconnect).toHaveBeenCalled();
  });
});
