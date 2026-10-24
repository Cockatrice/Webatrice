import { act, screen } from '@testing-library/react';
import { server } from '@cockatrice/datatrice';
import type { WebClient } from '@cockatrice/sockatrice';
import { Response_ResponseCode } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { SessionScope } from '../../../SessionScope';
import { connectedState, makeUser, renderWithProviders } from '../../../__test-utils__';
import { useEditUser } from './EditUserDialog/useEditUser';
import { useChangePassword } from './ChangePasswordDialog/useChangePassword';
import { useChangeAvatar } from './ChangeAvatarDialog/useChangeAvatar';
import { encodeAvatar, loadImage } from './ChangeAvatarDialog/encodeAvatar';

vi.mock('./ChangeAvatarDialog/encodeAvatar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ChangeAvatarDialog/encodeAvatar')>()),
  encodeAvatar: vi.fn(),
  loadImage: vi.fn(),
}));

const user = makeUser({ realName: 'Alice', email: 'alice@example.com', country: 'us' });
const cases = [
  {
    name: 'edit',
    success: 'EditUserDialog.success',
    useFlow: (onDone: () => void) => {
      const flow = useEditUser(onDone);
      return { ...flow, submit: () => flow.submit({
        realName: 'Alice', email: 'alice@example.com', country: 'US', passwordCheck: '',
      }) };
    },
    callbacks: (client: WebClient) => {
      const call = vi.mocked(client.request.session.accountEdit).mock.calls.at(-1)!;
      return { success: () => call[1]!(), failure: () => call[2]!(Response_ResponseCode.RespWrongPassword) };
    },
  },
  {
    name: 'password',
    success: 'ChangePasswordDialog.success',
    useFlow: (onDone: () => void) => {
      const flow = useChangePassword(onDone);
      return { ...flow, submit: () => flow.submit({
        oldPassword: 'oldpassword', newPassword: 'newpassword', newPasswordConfirm: 'newpassword',
      }) };
    },
    callbacks: (client: WebClient) => {
      const call = vi.mocked(client.request.session.accountPassword).mock.calls.at(-1)!;
      return { success: () => call[2]!(), failure: () => call[3]!(Response_ResponseCode.RespWrongPassword) };
    },
  },
  {
    name: 'avatar',
    success: 'ChangeAvatarDialog.success',
    useFlow: useChangeAvatar,
    callbacks: (client: WebClient) => {
      const call = vi.mocked(client.request.session.accountImage).mock.calls.at(-1)!;
      return { success: () => call[1]!(), failure: () => call[2]!(Response_ResponseCode.RespFunctionNotAllowed) };
    },
  },
];

interface Flow {
  pending: boolean;
  error: string | null;
  submit: () => void | Promise<void>;
}

function setup<T extends Flow>(
  useFlow: (onDone: () => void) => T,
) {
  const onDone = vi.fn();
  let current!: T;
  function Probe() {
    current = useFlow(onDone);
    return null;
  }
  const view = renderWithProviders(<SessionScope><Probe /></SessionScope>, {
    preloadedState: { ...connectedState, server: { ...connectedState.server!, user } },
  });
  const profile = () => act(() => {
    view.store.dispatch(server.Actions.getUserInfo({ userInfo: user }));
  });
  profile();
  return {
    ...view,
    onDone,
    flow: () => current,
    submit: () => act(async () => {
      await current.submit();
    }),
    reopen: () => {
      view.rerender(<SessionScope><Probe key="reopened" /></SessionScope>);
      profile();
    },
  };
}

describe.each(cases)('$name request ownership', ({ useFlow, callbacks, success }) => {
  it.each(['success', 'failure'] as const)('ignores an earlier dialog %s while the reopened dialog is pending', async (outcome) => {
    const view = setup<Flow>(useFlow);
    await view.submit();
    const old = callbacks(view.webClient);
    view.reopen();
    await view.submit();
    const latest = callbacks(view.webClient);

    act(old[outcome]);
    expect(view.flow().pending).toBe(true);
    expect(view.flow().error).toBeNull();
    expect(view.onDone).not.toHaveBeenCalled();
    expect(screen.queryByText(success)).not.toBeInTheDocument();

    act(latest.success);
    expect(view.flow().pending).toBe(false);
    expect(view.onDone).toHaveBeenCalledTimes(1);
  });

  it('ignores settled callbacks during a retry and consumes the new success once', async () => {
    const view = setup<Flow>(useFlow);
    await view.submit();
    const old = callbacks(view.webClient);
    act(old.failure);
    expect(view.flow().pending).toBe(false);
    expect(view.flow().error).not.toBeNull();
    await view.submit();
    const latest = callbacks(view.webClient);
    act(() => {
      old.success(); old.failure();
    });
    expect(view.flow().pending).toBe(true);
    expect(view.flow().error).toBeNull();
    expect(view.onDone).not.toHaveBeenCalled();
    act(() => {
      latest.success(); latest.success(); latest.failure();
    });
    expect(view.flow().pending).toBe(false);
    expect(view.flow().error).toBeNull();
    expect(view.onDone).toHaveBeenCalledTimes(1);
  });

  it.each(['disconnect', 'clear'] as const)('ends pending state on session %s and rejects callbacks before remount', async (boundary) => {
    const view = setup<Flow>(useFlow);
    await view.submit();
    expect(view.flow().pending).toBe(true);
    const old = callbacks(view.webClient);
    act(() => {
      view.store.dispatch(boundary === 'clear' ? server.Actions.clearStore() : server.Actions.updateStatus({
        status: { state: WebsocketTypes.StatusEnum.DISCONNECTED, description: null },
      }));
      old.success();
      old.failure();
    });
    expect(view.flow().pending).toBe(false);
    expect(view.flow().error).toBeNull();
    expect(view.onDone).not.toHaveBeenCalled();
    expect(screen.queryByText(success)).not.toBeInTheDocument();
  });
});

describe('avatar encoding across dialog lifetimes', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:avatar');
      static revokeObjectURL = vi.fn();
    });
    vi.mocked(loadImage).mockResolvedValue({} as HTMLImageElement);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['close', 'session'] as const)('does not send an encoded image after %s', async (boundary) => {
    let finish!: (image: Uint8Array) => void;
    vi.mocked(encodeAvatar).mockReturnValueOnce(new Promise((resolve) => {
      finish = resolve;
    }));
    const view = setup(useChangeAvatar);
    await act(async () => {
      await view.flow().pick(new File(['a'], 'avatar.png'));
    });
    let pending!: Promise<void>;
    act(() => {
      pending = view.flow().submit();
    });
    expect(view.flow().pending).toBe(true);
    if (boundary === 'close') {
      view.reopen();
    } else {
      act(() => {
        view.store.dispatch(server.Actions.clearStore());
      });
    }
    await act(async () => {
      finish(new Uint8Array([1])); await pending;
    });
    expect(view.webClient.request.session.accountImage).not.toHaveBeenCalled();
    expect(view.flow().pending).toBe(false);
    expect(view.flow().error).toBeNull();
  });
});

it('does not let a late password hashing rejection replace a newer outcome', async () => {
  const view = setup(cases[1].useFlow);
  let reject!: (error: Error) => void;
  vi.mocked(view.webClient.request.session.accountPassword).mockReturnValueOnce(new Promise<void>((_resolve, fail) => {
    reject = fail;
  }));
  let pending!: void | Promise<void>;
  act(() => {
    pending = view.flow().submit();
  });
  await view.submit();
  await act(async () => {
    reject(new Error('secret')); await pending;
  });
  expect(view.flow().pending).toBe(true);
  expect(view.flow().error).toBeNull();
});
