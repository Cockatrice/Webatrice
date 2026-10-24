import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { act, screen } from '@testing-library/react';
import { server } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag as Flag } from '@cockatrice/sockatrice/generated';

import { Avatar, UserAvatarProvider } from '@app/components';
import { endSession } from '@app/services/session';
import { rootReducerMap, type RootState } from '@app/store';
import { connectedState, makeUser, renderWithProviders } from '../__test-utils__';

const PNG = new Uint8Array([137, 80, 78, 71]);

function plainStore() {
  return configureStore({
    reducer: combineReducers(rootReducerMap),
    preloadedState: {
      ...connectedState,
      server: {
        ...connectedState.server!,
        users: { alice: makeUser({ name: 'alice', userLevel: Flag.IsRegistered }) },
      },
    } as RootState,
  });
}

function renderAvatars(names: string[], extra?: React.ReactNode) {
  return renderWithProviders(
    <UserAvatarProvider>
      {names.map((name, index) => (
        <div key={`${name}-${index}`} data-testid={`avatar-${index}`}><Avatar name={name} /></div>
      ))}
      {extra}
    </UserAvatarProvider>,
    { store: plainStore() },
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  let next = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:avatar-${++next}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('fetches a missing avatar once for every icon of that user and then shows the picture', () => {
  const { webClient, store } = renderAvatars(['alice', 'alice']);
  act(() => {
    vi.runAllTimers();
  });
  const getUserInfo = vi.mocked(webClient.request.session.getUserInfo);
  expect(getUserInfo.mock.calls.filter(([name]) => name === 'alice')).toHaveLength(1);
  expect(screen.getByTestId('avatar-0')).toHaveTextContent('A');

  act(() => {
    store.dispatch(server.Actions.getUserInfo({ userInfo: makeUser({ name: 'alice', avatarBmp: PNG }) }));
  });
  const images = document.querySelectorAll('img');
  expect(images).toHaveLength(2);
  expect(images[0].getAttribute('src')).toBe('blob:avatar-1');
  expect(images[1].getAttribute('src')).toBe('blob:avatar-1');
});

it('keeps the letter when the user has no avatar and never asks again', () => {
  const { webClient, store } = renderAvatars(['alice']);
  act(() => {
    vi.runAllTimers();
    store.dispatch(server.Actions.getUserInfo({ userInfo: makeUser({ name: 'alice' }) }));
  });
  expect(screen.getByTestId('avatar-0')).toHaveTextContent('A');
  expect(document.querySelector('img')).toBeNull();
  expect(vi.mocked(webClient.request.session.getUserInfo)).toHaveBeenCalledTimes(1);
});

it('uses an explicit src without fetching', () => {
  const { webClient } = renderWithProviders(
    <UserAvatarProvider><Avatar name="alice" src="data:image/png;base64,AA==" /></UserAvatarProvider>,
    { preloadedState: connectedState },
  );
  act(() => {
    vi.runAllTimers();
  });
  expect(document.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AA==');
  expect(vi.mocked(webClient.request.session.getUserInfo)).not.toHaveBeenCalled();
});

it('shows the letter without a provider', () => {
  renderWithProviders(<Avatar name="bob" />, { preloadedState: connectedState });
  expect(screen.getByText('B')).toBeInTheDocument();
});

it('asks again for the same user after the session ends and the icons remount', () => {
  const view = renderWithProviders(
    <UserAvatarProvider><Avatar key="first" name="alice" /></UserAvatarProvider>,
    { preloadedState: connectedState },
  );
  act(() => {
    vi.runAllTimers();
  });
  act(() => {
    endSession();
  });
  view.rerender(<UserAvatarProvider><Avatar key="second" name="alice" /></UserAvatarProvider>);
  act(() => {
    vi.runAllTimers();
  });
  expect(vi.mocked(view.webClient.request.session.getUserInfo).mock.calls).toEqual([['alice'], ['alice']]);
});
