import { act, fireEvent, screen } from '@testing-library/react';
import { server } from '@cockatrice/datatrice';

import { connectedState, makeUser, renderWithProviders } from '../../__test-utils__';
import Message, { PlayerLink } from './Message';
import * as parsing from './useMessage';
import * as display from '../UserDisplay/useUserDisplay';

it('skips parsing unchanged message props and rerenders changed text', () => {
  const parse = vi.spyOn(parsing, 'useParsedMessage');
  const message = { message: 'alice: hello' };
  const { rerender } = renderWithProviders(<Message message={message} />);
  parse.mockClear();
  rerender(<Message message={message} />);
  expect(parse).not.toHaveBeenCalled();
  rerender(<Message message={{ message: 'alice: changed' }} />);
  expect(screen.getByText('changed')).toBeInTheDocument();
  expect(parse).toHaveBeenCalledTimes(1);
});

it('subscribes each player link only to its own buddy and ignore membership', () => {
  const observe = vi.spyOn(display, 'useUserDisplay');
  const { store, rerender } = renderWithProviders(<PlayerLink name="alice" />, { preloadedState: connectedState });
  observe.mockClear();
  rerender(<PlayerLink name="alice" />);
  expect(observe).not.toHaveBeenCalled();
  act(() => {
    store.dispatch(server.Actions.addToBuddyList({ user: makeUser({ name: 'bob' }) }));
    store.dispatch(server.Actions.addToIgnoreList({ user: makeUser({ name: 'bob' }) }));
  });
  expect(observe).not.toHaveBeenCalled();
  act(() => {
    store.dispatch(server.Actions.addToBuddyList({ user: makeUser({ name: 'alice' }) }));
    store.dispatch(server.Actions.addToIgnoreList({ user: makeUser({ name: 'alice' }) }));
  });
  expect(observe).toHaveBeenCalledTimes(1);
  fireEvent.contextMenu(screen.getByRole('link', { name: 'alice' }));
  expect(screen.getByRole('menuitem', { name: 'UserActionsMenu.removeBuddy' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'UserActionsMenu.removeIgnore' })).toBeInTheDocument();
});
