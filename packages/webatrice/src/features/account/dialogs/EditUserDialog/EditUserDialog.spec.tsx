import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { Response_ResponseCode } from '@cockatrice/sockatrice/generated';
import { server } from '@cockatrice/datatrice';

import { connectedState, makeUser, renderWithProviders } from '../../../../__test-utils__';
import EditUserDialog from './EditUserDialog';

function stateWith(options: { supportsPasswordHash?: boolean | undefined }) {
  const supportsPasswordHash = 'supportsPasswordHash' in options ? options.supportsPasswordHash : false;
  return {
    ...connectedState,
    server: {
      ...(connectedState.server as any),
      info: { ...(connectedState.server as any).info, supportsPasswordHash },
      user: makeUser({ email: 'old@example.com', country: 'us', realName: 'Alice' }),
    },
  };
}

function setup(options: { supportsPasswordHash?: boolean | undefined } = {}, resolveProfile = true) {
  const handleClose = vi.fn();
  const view = renderWithProviders(<EditUserDialog isOpen handleClose={handleClose} />, {
    preloadedState: stateWith(options),
  });
  const accountEdit = vi.mocked(view.webClient.request.session.accountEdit);
  if (resolveProfile) {
    act(() => {
      view.store.dispatch(server.Actions.getUserInfo({ userInfo: stateWith(options).server.user }));
    });
  }
  return { ...view, handleClose, accountEdit };
}

const emailInput = () => screen.getByLabelText('Common.label.email') as HTMLInputElement;
const submit = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'AccountDialogs.label.ok' }));
  });
};

describe('EditUserDialog', () => {
  it('re-fetches the caller’s own record and prefills the form from the profile', () => {
    const { webClient } = setup();

    expect(webClient.request.session.getUserInfo).toHaveBeenCalledWith('');
    expect(emailInput().value).toBe('old@example.com');
    expect((screen.getByLabelText('Common.label.realName') as HTMLInputElement).value).toBe('Alice');
  });

  it('waits for fresh self info before opening, even with an existing cached profile', () => {
    const state = stateWith({});
    const { store, webClient } = renderWithProviders(<EditUserDialog isOpen handleClose={vi.fn()} />, {
      preloadedState: { ...state, server: { ...state.server, userInfo: { [state.server.user.name]: state.server.user } } },
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(webClient.request.session.accountEdit).not.toHaveBeenCalled();
    act(() => {
      store.dispatch(server.Actions.getUserInfo({ userInfo: makeUser({ name: 'someone-else' }) }));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      store.dispatch(server.Actions.getUserInfo({
        userInfo: makeUser({ email: 'fresh@example.com', country: 'de', realName: 'Alice' }),
      }));
    });

    expect(emailInput().value).toBe('fresh@example.com');
  });

  it('shows a failed refresh without allowing cached values to be submitted', () => {
    const { store, accountEdit } = setup({}, false);
    act(() => {
      store.dispatch(server.Actions.getUserInfoFailed({ userName: '', responseCode: Response_ResponseCode.RespNotConnected }));
    });
    expect(screen.getByText('EditUserDialog.fetchFailed')).toBeInTheDocument();
    expect(screen.queryByLabelText('Common.label.realName')).not.toBeInTheDocument();
    expect(accountEdit).not.toHaveBeenCalled();
  });

  it('does not replace an editing snapshot with later user-info broadcasts', () => {
    const { store } = setup();
    fireEvent.change(emailInput(), { target: { value: 'draft@example.com' } });
    act(() => {
      store.dispatch(server.Actions.getUserInfo({ userInfo: makeUser({ email: 'later@example.com', realName: 'Later' }) }));
    });
    expect(emailInput()).toHaveValue('draft@example.com');
    expect(screen.getByLabelText('Common.label.realName')).toHaveValue('Alice');
  });

  it('sends the full record, country lowercased, to servers without password hashing', async () => {
    const { accountEdit } = setup();

    fireEvent.change(screen.getByLabelText('Common.label.realName'), { target: { value: 'Alice Smith' } });
    await submit();

    expect(accountEdit).toHaveBeenCalledWith(
      { realName: 'Alice Smith', country: 'us', email: 'old@example.com' },
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('leaves an unchanged email out on hash-capable servers', async () => {
    const { accountEdit } = setup({ supportsPasswordHash: true });

    await submit();

    expect(accountEdit.mock.calls[0][0]).toEqual({ realName: 'Alice', country: 'us' });
    expect(screen.queryByLabelText('EditUserDialog.label.passwordCheck')).not.toBeInTheDocument();
  });

  it('requires the current password to change the email on hash-capable servers', async () => {
    const { accountEdit } = setup({ supportsPasswordHash: true });

    fireEvent.change(emailInput(), { target: { value: 'new@example.com' } });
    await submit();
    expect(accountEdit).not.toHaveBeenCalled();
    expect(screen.getByText('Common.validation.required')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/EditUserDialog\.label\.passwordCheck/), { target: { value: 'secret' } });
    await submit();

    expect(accountEdit.mock.calls[0][0]).toEqual({
      realName: 'Alice',
      country: 'us',
      email: 'new@example.com',
      passwordCheck: 'secret',
    });
  });

  it('asks for the password check while the server capability is still unknown', async () => {
    const { accountEdit } = setup({ supportsPasswordHash: undefined });

    await submit();
    expect(accountEdit.mock.calls[0][0]).toEqual({ realName: 'Alice', country: 'us' });

    fireEvent.change(emailInput(), { target: { value: 'new@example.com' } });
    expect(screen.getByLabelText('EditUserDialog.label.passwordCheck')).toBeInTheDocument();
  });

  it('keeps the dialog open with the desktop message when the server refuses', async () => {
    const { accountEdit, handleClose } = setup();

    await submit();
    act(() => {
      accountEdit.mock.calls[0][2]!(Response_ResponseCode.RespWrongPassword);
    });

    expect(screen.getByRole('alert')).toHaveTextContent('AccountDialogs.error.passwordCheckWrong');
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('closes once the server accepts the edit', async () => {
    const { accountEdit, handleClose } = setup();

    await submit();
    act(() => {
      accountEdit.mock.calls[0][1]!();
    });

    await waitFor(() => expect(handleClose).toHaveBeenCalled());
  });
});
