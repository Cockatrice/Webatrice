import { act, fireEvent, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import {
  Command_AccountEdit_ext,
  Command_AccountImage_ext,
  Command_AccountPassword_ext,
  Command_GetUserInfo_ext,
  Response_GetUserInfo_ext,
  Response_GetUserInfoSchema,
  Response_ResponseCode,
} from '@cockatrice/sockatrice/generated';
import { Account } from '@app/features/account';
import { SessionScope } from '../../../src/SessionScope';
import { connectAndLogin } from '../helpers/setup';
import { findLastSessionCommand } from '../helpers/command-capture';
import { buildResponse, buildResponseMessage, deliverMessage } from '../helpers/protobuf-builders';
import { renderFeatureScreen } from './helpers';

beforeEach(() => {
  vi.useRealTimers();
  connectAndLogin('alice');
});

const cases = [
  { name: 'edit', action: 'Account.action.edit', success: 'EditUserDialog.success' },
  { name: 'password', action: 'Account.action.changePassword', success: 'ChangePasswordDialog.success' },
  { name: 'avatar', action: 'Account.action.changeAvatar', success: 'ChangeAvatarDialog.success' },
];

async function submit(name: string, action: string) {
  fireEvent.click(screen.getByRole('button', { name: action }));
  if (name === 'edit') {
    const info = findLastSessionCommand(Command_GetUserInfo_ext);
    act(() => deliverMessage(buildResponseMessage(buildResponse({
      cmdId: info.cmdId,
      ext: Response_GetUserInfo_ext,
      value: create(Response_GetUserInfoSchema, {
        userInfo: { name: 'alice', realName: 'Alice', email: 'alice@example.com', country: 'us' },
      }),
    }))));
  } else if (name === 'password') {
    for (const [field, value] of [['oldPassword', 'oldpassword'], ['newPassword', 'newpassword'], ['newPasswordConfirm', 'newpassword']]) {
      fireEvent.change(screen.getByLabelText(`ChangePasswordDialog.label.${field}`), { target: { value } });
    }
  }
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'AccountDialogs.label.ok' }));
  });
  if (name === 'edit') {
    return findLastSessionCommand(Command_AccountEdit_ext).cmdId;
  }
  if (name === 'password') {
    return findLastSessionCommand(Command_AccountPassword_ext).cmdId;
  }
  return findLastSessionCommand(Command_AccountImage_ext).cmdId;
}

describe.each(cases)('$name dialog request ownership (integration)', ({ name, action, success }) => {
  it.each([Response_ResponseCode.RespOk, Response_ResponseCode.RespFunctionNotAllowed])(
    'ignores stale response %s after cancel and reopen while the latest submit completes', async (responseCode) => {
      renderFeatureScreen(<SessionScope><Account /></SessionScope>);
      const first = await submit(name, action);
      fireEvent.click(screen.getByRole('button', { name: 'AccountDialogs.label.cancel' }));
      const latest = await submit(name, action);
      expect(latest).not.toBe(first);

      act(() => deliverMessage(buildResponseMessage(buildResponse({ cmdId: first, responseCode }))));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'AccountDialogs.label.ok' })).toBeDisabled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText(success)).not.toBeInTheDocument();

      act(() => deliverMessage(buildResponseMessage(buildResponse({ cmdId: latest, responseCode: Response_ResponseCode.RespOk }))));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText(success)).toBeInTheDocument();
    },
  );
});
