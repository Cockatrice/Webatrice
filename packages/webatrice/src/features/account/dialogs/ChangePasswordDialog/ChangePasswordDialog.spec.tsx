import { act, fireEvent, screen } from '@testing-library/react';
import { Response_ResponseCode } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { connectedState, renderWithProviders } from '../../../../__test-utils__';
import ChangePasswordDialog from './ChangePasswordDialog';

function setup() {
  const handleClose = vi.fn();
  const view = renderWithProviders(<ChangePasswordDialog isOpen handleClose={handleClose} />, {
    preloadedState: connectedState,
  });
  const accountPassword = vi.mocked(view.webClient.request.session.accountPassword);
  return { ...view, handleClose, accountPassword };
}

const fill = (oldPassword: string, newPassword: string, confirm = newPassword) => {
  fireEvent.change(screen.getByLabelText('ChangePasswordDialog.label.oldPassword'), { target: { value: oldPassword } });
  fireEvent.change(screen.getByLabelText('ChangePasswordDialog.label.newPassword'), { target: { value: newPassword } });
  fireEvent.change(screen.getByLabelText('ChangePasswordDialog.label.newPasswordConfirm'), { target: { value: confirm } });
};

const submit = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'AccountDialogs.label.ok' }));
  });
};

describe('ChangePasswordDialog', () => {
  it('settles a hashing rejection without exposing the error and permits retry', async () => {
    const { accountPassword, handleClose } = setup();
    accountPassword.mockRejectedValueOnce(new Error('hash failed: secret input'));
    fill('oldpassword', 'newpassword');
    await submit();

    expect(screen.getByRole('alert')).toHaveTextContent('AccountDialogs.error.updateFailed');
    expect(screen.queryByText(/secret input/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AccountDialogs.label.ok' })).toBeEnabled();
    expect(handleClose).not.toHaveBeenCalled();
    await submit();
    expect(accountPassword).toHaveBeenCalledTimes(2);
  });

  it('sends the old and new password through the web client', async () => {
    const { accountPassword } = setup();

    fill('oldpassword', 'newpassword');
    await submit();

    expect(accountPassword).toHaveBeenCalledWith('oldpassword', 'newpassword', expect.any(Function), expect.any(Function));
  });

  it('blocks a mismatched confirmation before anything is sent', async () => {
    const { accountPassword } = setup();

    fill('oldpassword', 'newpassword', 'different');
    await submit();

    expect(accountPassword).not.toHaveBeenCalled();
    expect(screen.getByText('Common.validation.passwordsMustMatch')).toBeInTheDocument();
  });

  it('keeps the input and explains a server refusal', async () => {
    const { accountPassword, handleClose } = setup();

    fill('wrongpassword', 'newpassword');
    await submit();
    act(() => {
      accountPassword.mock.calls[0][3]!(Response_ResponseCode.RespWrongPassword);
    });

    expect(screen.getByRole('alert')).toHaveTextContent('AccountDialogs.error.oldPasswordWrong');
    expect((screen.getByLabelText('ChangePasswordDialog.label.newPassword') as HTMLInputElement).value).toBe('newpassword');
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('explains a timeout with the transport reason rather than a server message', async () => {
    const { accountPassword } = setup();

    fill('oldpassword', 'newpassword');
    await submit();
    act(() => {
      accountPassword.mock.calls[0][3]!(Response_ResponseCode.RespNotConnected, WebsocketTypes.CommandFailure.Timeout);
    });

    expect(screen.getByRole('alert')).toHaveTextContent('CommandFailure.timeout');
  });

  it('closes once the server accepts the change', async () => {
    const { accountPassword, handleClose } = setup();

    fill('oldpassword', 'newpassword');
    await submit();
    act(() => {
      accountPassword.mock.calls[0][2]!();
    });

    expect(handleClose).toHaveBeenCalled();
  });
});
