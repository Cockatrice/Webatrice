import type { TFunction } from 'i18next';
import { Response_ResponseCode } from '@cockatrice/sockatrice/generated';

export function editUserErrorMessage(t: TFunction, responseCode: number): string {
  switch (responseCode) {
    case Response_ResponseCode.RespFunctionNotAllowed:
      return t('AccountDialogs.error.editNotAllowed');
    case Response_ResponseCode.RespWrongPassword:
      return t('AccountDialogs.error.passwordCheckWrong');
    default:
      return t('AccountDialogs.error.updateFailed');
  }
}

export function changePasswordErrorMessage(t: TFunction, responseCode: number): string {
  switch (responseCode) {
    case Response_ResponseCode.RespFunctionNotAllowed:
      return t('AccountDialogs.error.passwordNotAllowed');
    case Response_ResponseCode.RespPasswordTooShort:
      return t('AccountDialogs.error.passwordTooShort');
    case Response_ResponseCode.RespWrongPassword:
      return t('AccountDialogs.error.oldPasswordWrong');
    default:
      return t('AccountDialogs.error.updateFailed');
  }
}

export function changeAvatarErrorMessage(t: TFunction, responseCode: number): string {
  switch (responseCode) {
    case Response_ResponseCode.RespFunctionNotAllowed:
      return t('AccountDialogs.error.avatarNotAllowed');
    default:
      return t('AccountDialogs.error.avatarFailed');
  }
}
