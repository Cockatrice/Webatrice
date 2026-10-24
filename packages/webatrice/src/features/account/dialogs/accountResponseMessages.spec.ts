import { Response_ResponseCode } from '@cockatrice/sockatrice/generated';

import { changeAvatarErrorMessage, changePasswordErrorMessage, editUserErrorMessage } from './accountResponseMessages';

const t = ((key: string) => key) as any;

describe('account response messages', () => {
  it('maps edit response codes like desktop processEditResponse', () => {
    expect(editUserErrorMessage(t, Response_ResponseCode.RespFunctionNotAllowed)).toBe('AccountDialogs.error.editNotAllowed');
    expect(editUserErrorMessage(t, Response_ResponseCode.RespWrongPassword)).toBe('AccountDialogs.error.passwordCheckWrong');
    expect(editUserErrorMessage(t, Response_ResponseCode.RespInternalError)).toBe('AccountDialogs.error.updateFailed');
  });

  it('maps password response codes like desktop processPasswordResponse', () => {
    expect(changePasswordErrorMessage(t, Response_ResponseCode.RespFunctionNotAllowed))
      .toBe('AccountDialogs.error.passwordNotAllowed');
    expect(changePasswordErrorMessage(t, Response_ResponseCode.RespPasswordTooShort)).toBe('AccountDialogs.error.passwordTooShort');
    expect(changePasswordErrorMessage(t, Response_ResponseCode.RespWrongPassword)).toBe('AccountDialogs.error.oldPasswordWrong');
    expect(changePasswordErrorMessage(t, Response_ResponseCode.RespContextError)).toBe('AccountDialogs.error.updateFailed');
  });

  it('maps avatar response codes like desktop processAvatarResponse', () => {
    expect(changeAvatarErrorMessage(t, Response_ResponseCode.RespFunctionNotAllowed)).toBe('AccountDialogs.error.avatarNotAllowed');
    expect(changeAvatarErrorMessage(t, Response_ResponseCode.RespInternalError)).toBe('AccountDialogs.error.avatarFailed');
  });
});
