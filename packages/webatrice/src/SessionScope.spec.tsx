import { StrictMode, useState } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { server } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { onSessionEnd } from '@app/services/session';
import { useRequestTracker, type RequestTracker } from '@app/hooks';
import { renderWithProviders, connectedState, disconnectedState } from './__test-utils__';
import { ModerationProvider } from './feature-widgets/moderation/ModerationProvider';
import { useModerationMenu } from './feature-widgets/moderation/useModerationMenu';
import { SessionScope } from './SessionScope';

it('cleans modules before remount, cancels requests synchronously and preserves routing', () => {
  let cache = 'old session';
  let tracker!: RequestTracker;
  const cleanup = vi.fn(() => {
    cache = '';
  });
  const unsubscribe = onSessionEnd(cleanup);
  function Probe() {
    const [draft, setDraft] = useState(cache);
    tracker = useRequestTracker();
    return <input aria-label="draft" value={draft} onChange={(event) => setDraft(event.target.value)} />;
  }
  function Location() {
    return <span>{useLocation().pathname}</span>;
  }
  const view = renderWithProviders(<StrictMode><Location /><SessionScope><Probe /></SessionScope></StrictMode>, {
    preloadedState: disconnectedState, route: '/server',
  });
  try {
    expect(cleanup).not.toHaveBeenCalled();
    const old = tracker;
    const id = old.begin();
    old.track('parallel');
    act(() => {
      view.store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null } }));
      expect(old.isCurrent(id)).toBe(false);
      expect(old.settle('parallel')).toBe(false);
    });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: 'draft' })).toHaveValue('');
    expect(screen.getByText('/server')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new draft' } });
    act(() => view.store.dispatch(server.Actions.updateStatus({
      status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: 'same login' },
    })));
    expect(screen.getByRole('textbox')).toHaveValue('new draft');
    expect(cleanup).toHaveBeenCalledTimes(1);
    act(() => view.store.dispatch(server.Actions.clearStore()));
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(cleanup).toHaveBeenCalledTimes(2);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'discard on disconnect' } });
    act(() => view.store.dispatch(server.Actions.updateStatus({
      status: { state: WebsocketTypes.StatusEnum.DISCONNECTED, description: null },
    })));
    expect(cleanup).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('textbox')).toHaveValue('');
    view.unmount();
    act(() => view.store.dispatch(server.Actions.clearStore()));
    expect(cleanup).toHaveBeenCalledTimes(3);
  } finally {
    unsubscribe();
  }
});

it('remounts the real moderation provider with no dialog after a session reset', () => {
  function Trigger() {
    const { open } = useModerationMenu('alice');
    return <button onClick={() => open('warnUser')}>warn</button>;
  }
  const { store } = renderWithProviders(
    <SessionScope><ModerationProvider><Trigger /></ModerationProvider></SessionScope>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'warn' }));
  expect(screen.getByRole('dialog', { name: 'Moderation.common.loading' })).toBeInTheDocument();
  act(() => store.dispatch(server.Actions.clearStore()));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('removes an open private admin-notes dialog and its text on DISCONNECTED', () => {
  function Trigger() {
    const { open } = useModerationMenu('alice');
    return <button onClick={() => open('adminNotes')}>notes</button>;
  }
  const { store, webClient } = renderWithProviders(
    <SessionScope><ModerationProvider><Trigger /></ModerationProvider></SessionScope>,
    { preloadedState: connectedState },
  );
  fireEvent.click(screen.getByRole('button', { name: 'notes' }));
  const requestId = vi.mocked(webClient.request.moderator.getAdminNotes).mock.lastCall?.[1];
  act(() => store.dispatch(server.Actions.getAdminNotes({ userName: 'alice', notes: 'Private investigation notes', requestId })));
  expect(screen.getByRole('dialog', { name: 'Moderation.adminNotes.title' })).toBeInTheDocument();
  expect(screen.getByDisplayValue('Private investigation notes')).toBeVisible();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsaved private notes' } });
  act(() => store.dispatch(server.Actions.updateStatus({
    status: { state: WebsocketTypes.StatusEnum.DISCONNECTED, description: 'Connection Closed' },
  })));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('Private investigation notes')).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('Unsaved private notes')).not.toBeInTheDocument();
  expect(store.getState().server.adminNotes).toEqual({});
});
