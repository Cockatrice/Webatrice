import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import {
  Command_AccountEdit_ext,
  Command_AccountPassword_ext,
  Command_GetUserInfo_ext,
  Response_GetUserInfo_ext,
  Response_GetUserInfoSchema,
  Response_ResponseCode,
  ServerInfo_UserSchema,
} from '@cockatrice/sockatrice/generated';
import { server } from '@cockatrice/datatrice';

import { Account } from '@app/features/account';

import { connectAndLogin } from '../helpers/setup';
import { findLastSessionCommand } from '../helpers/command-capture';
import { buildResponse, buildResponseMessage, deliverMessage } from '../helpers/protobuf-builders';
import { renderFeatureScreen, simulateLoggedIn, store } from './helpers';

beforeEach(() => {
  vi.useRealTimers();
  simulateLoggedIn();
});

describe('Account (integration)', () => {
  it('renders the buddy list and ignored users panels', () => {
    renderFeatureScreen(<Account />);

    expect(screen.getByText('Account.buddies.online')).toBeInTheDocument();
    expect(screen.getByText('Account.ignored.online')).toBeInTheDocument();
  });

  it('shows the Disconnect button and clicking it does not throw', () => {
    renderFeatureScreen(<Account />);

    const disconnect = screen.getByRole('button', { name: /Common\.disconnect/ });
    expect(disconnect).toBeInTheDocument();
    expect(() => fireEvent.click(disconnect)).not.toThrow();
  });

  describe('self-service account dialogs', () => {
    const respond = (cmdId: number, responseCode: Response_ResponseCode) => {
      act(() => {
        deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode })));
      });
    };
    const confirm = async () => {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'AccountDialogs.label.ok' }));
      });
    };

    beforeEach(() => {
      connectAndLogin('alice');
    });

    it('edits the profile through Command_AccountEdit and updates the current user on RespOk', async () => {
      store.dispatch(server.Actions.getUserInfo({
        userInfo: create(ServerInfo_UserSchema, { name: 'alice', realName: 'Stale', email: 'stale@example.com', country: 'us' }),
      }));
      renderFeatureScreen(<Account />);

      fireEvent.click(screen.getByRole('button', { name: 'Account.action.edit' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      const info = findLastSessionCommand(Command_GetUserInfo_ext);
      expect(info.value.userName).toBe('');
      act(() => {
        deliverMessage(buildResponseMessage(buildResponse({
          cmdId: info.cmdId,
          ext: Response_GetUserInfo_ext,
          value: create(Response_GetUserInfoSchema, {
            userInfo: { name: 'alice', realName: 'Fresh', email: 'fresh@example.com', country: 'de' },
          }),
        })));
      });
      expect(screen.getByLabelText('Common.label.realName')).toHaveValue('Fresh');
      fireEvent.change(screen.getByLabelText('Common.label.realName'), { target: { value: 'Alice Liddell' } });
      await confirm();

      const edit = findLastSessionCommand(Command_AccountEdit_ext);
      expect(edit.value.realName).toBe('Alice Liddell');
      expect(edit.value.country).toBe('de');
      expect(edit.value.email).toBe('fresh@example.com');
      respond(edit.cmdId, Response_ResponseCode.RespOk);

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(server.Selectors.getUser(store.getState())?.realName).toBe('Alice Liddell');
      expect(server.Selectors.getUserInfoByName(store.getState(), 'alice')).toBeUndefined();
    });

    it('keeps the edit form closed when refreshing self info fails', () => {
      renderFeatureScreen(<Account />);
      fireEvent.click(screen.getByRole('button', { name: 'Account.action.edit' }));
      const info = findLastSessionCommand(Command_GetUserInfo_ext);
      respond(info.cmdId, Response_ResponseCode.RespNotConnected);
      expect(screen.getByText('EditUserDialog.fetchFailed')).toBeInTheDocument();
      expect(screen.queryByLabelText('Common.label.realName')).not.toBeInTheDocument();
    });

    it('changes the password through Command_AccountPassword and explains a wrong old password', async () => {
      renderFeatureScreen(<Account />);

      fireEvent.click(screen.getByRole('button', { name: 'Account.action.changePassword' }));
      fireEvent.change(screen.getByLabelText('ChangePasswordDialog.label.oldPassword'), { target: { value: 'not-it' } });
      fireEvent.change(screen.getByLabelText('ChangePasswordDialog.label.newPassword'), { target: { value: 'newpassword' } });
      fireEvent.change(screen.getByLabelText('ChangePasswordDialog.label.newPasswordConfirm'), { target: { value: 'newpassword' } });
      await confirm();

      const change = await waitFor(() => findLastSessionCommand(Command_AccountPassword_ext));
      expect(change.value).toMatchObject({ oldPassword: 'not-it', newPassword: 'newpassword' });
      respond(change.cmdId, Response_ResponseCode.RespWrongPassword);

      expect(await screen.findByRole('alert')).toHaveTextContent('AccountDialogs.error.oldPasswordWrong');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
