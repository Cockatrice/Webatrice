import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useEffect, useState } from 'react';

import { renderWithProviders } from '../../__test-utils__';
import Toast, { type ToastActionButton } from './Toast';
import { ToastProvider, usePushToast, useToast } from './ToastContext';
import { ACTIONS, initialState, reducer } from './reducer';
import { toastLaneFor } from './toastLane';
import { endSession } from '../../services/session';

function ManagedToast() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(false)}>external close</button>
      <Toast open={open} onClose={() => setOpen(false)} autoHideDuration={1000}>
        managed body
      </Toast>
    </>
  );
}

function ToastHarness({ messageKey, body }: { messageKey: string; body: string }) {
  const { openToast, closeToast } = useToast({ key: messageKey, children: body });
  return (
    <div>
      <button type="button" onClick={() => openToast()}>open-{messageKey}</button>
      <button type="button" onClick={closeToast}>close-{messageKey}</button>
    </div>
  );
}

function AutoOpen({ messageKey, body }: { messageKey: string; body: string }) {
  const { openToast } = useToast({ key: messageKey, children: body });
  useEffect(() => {
    openToast();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fixture opens exactly once on mount
  }, []);
  return null;
}

function PushOnMount({ body, severity, action, sessionScoped }: {
  body: string;
  severity?: 'warning' | 'error';
  action?: ToastActionButton;
  sessionScoped?: boolean;
}) {
  const pushToast = usePushToast();
  useEffect(() => {
    pushToast(body, { severity, action, sessionScoped });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fixture pushes exactly once on mount
  }, []);
  return null;
}

function queryAlerts(): HTMLElement[] {
  return screen.queryAllByTestId('toast');
}

describe('Toast component', () => {
  it('renders the pill when open and removes it when closed', async () => {
    const { rerender } = renderWithProviders(
      <Toast open onClose={() => {}}>
        hello
      </Toast>,
    );
    await waitFor(() => expect(queryAlerts().length).toBeGreaterThan(0));

    rerender(
      <Toast open={false} onClose={() => {}}>
        hello
      </Toast>,
    );
    await waitFor(() => expect(queryAlerts().length).toBe(0));
  });

  it('invokes onClose when the close affordance is activated', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <Toast open onClose={onClose}>
        dismiss me
      </Toast>,
    );
    const closeButton = await screen.findByRole('button', { name: /dismiss/i });
    act(() => {
      closeButton.click();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('auto-dismisses after autoHideDuration elapses', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderWithProviders(
      <Toast open autoHideDuration={2500} onClose={onClose}>
        timed
      </Toast>,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('respects the parent-controlled open state for manual hide', async () => {
    renderWithProviders(<ManagedToast />);
    await waitFor(() => expect(queryAlerts().length).toBeGreaterThan(0));

    act(() => {
      screen.getByRole('button', { name: /external close/i }).click();
    });

    await waitFor(() => expect(queryAlerts().length).toBe(0));
  });
});

describe('ToastProvider + useToast', () => {
  it('mounts a toast keyed by the hook key and opens it via the handle', async () => {
    renderWithProviders(
      <ToastProvider>
        <ToastHarness messageKey="hello" body="hi there" />
      </ToastProvider>,
    );

    expect(queryAlerts().length).toBe(0);

    act(() => {
      screen.getByRole('button', { name: 'open-hello' }).click();
    });

    await waitFor(() => expect(queryAlerts().length).toBeGreaterThan(0));
  });

  it('stacks multiple toasts under different keys', async () => {
    renderWithProviders(
      <ToastProvider>
        <AutoOpen messageKey="a" body="alpha-toast" />
        <AutoOpen messageKey="b" body="beta-toast" />
      </ToastProvider>,
    );

    await waitFor(() => expect(queryAlerts().length).toBeGreaterThanOrEqual(2));
  });

  it('closes via the handle without unregistering the toast', async () => {
    renderWithProviders(
      <ToastProvider>
        <ToastHarness messageKey="m" body="manual" />
      </ToastProvider>,
    );

    act(() => {
      screen.getByRole('button', { name: 'open-m' }).click();
    });
    await waitFor(() => expect(queryAlerts().length).toBe(1));

    act(() => {
      screen.getByRole('button', { name: 'close-m' }).click();
    });

    await waitFor(() => expect(queryAlerts().length).toBe(0));

    act(() => {
      screen.getByRole('button', { name: 'open-m' }).click();
    });
    await waitFor(() => expect(queryAlerts().length).toBe(1));
  });

  it('unregisters a toast when the hook owner unmounts', async () => {
    function Container({ show }: { show: boolean }) {
      return (
        <ToastProvider>
          {show && <AutoOpen messageKey="x" body="ephemeral" />}
        </ToastProvider>
      );
    }
    const { rerender } = renderWithProviders(<Container show />);
    await waitFor(() => expect(queryAlerts().length).toBe(1));

    rerender(<Container show={false} />);

    await waitFor(() => expect(queryAlerts().length).toBe(0));
  });
});

describe('ToastProvider + usePushToast', () => {
  it('shows a pushed toast with the default success severity', async () => {
    renderWithProviders(
      <ToastProvider>
        <PushOnMount body="pushed" />
      </ToastProvider>,
    );

    const toast = await screen.findByTestId('toast');
    expect(toast).toHaveTextContent('pushed');
    expect(toast.querySelector('svg')).toHaveClass('text-success');
  });

  it('carries the requested severity to the pill', async () => {
    renderWithProviders(
      <ToastProvider>
        <PushOnMount body="careful" severity="warning" />
      </ToastProvider>,
    );

    const toast = await screen.findByTestId('toast');
    expect(toast.querySelector('svg')).toHaveClass('text-warning');
  });

  it('announces through persistent regions: errors assertively, the rest politely', async () => {
    renderWithProviders(
      <ToastProvider>
        <PushOnMount body="saved" />
        <PushOnMount body="failed" severity="error" />
      </ToastProvider>,
    );

    const saved = await screen.findByText('saved');
    const region = saved.closest('section') as HTMLElement;
    expect(region).toHaveAccessibleName('Toast.region');
    expect(region).toHaveAttribute('data-modal-exempt');
    expect(saved.closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
    expect(within(region).getByText('failed').closest('[aria-live]')).toHaveAttribute('aria-live', 'assertive');
  });

  it('removes a pushed toast when it times out', () => {
    vi.useFakeTimers();
    renderWithProviders(
      <ToastProvider>
        <PushOnMount body="brief" />
      </ToastProvider>,
    );
    expect(screen.getByText('brief')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5_900);
    });
    expect(screen.getByText('brief')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByText('brief')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows one action that runs and closes the toast', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <ToastProvider>
        <PushOnMount body="new message" action={{ label: 'Reply', onSelect }} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('new message')).not.toBeInTheDocument();
  });

  it('keeps only the newest three pushed toasts on screen', () => {
    renderWithProviders(
      <ToastProvider>
        {['one', 'two', 'three', 'four', 'five'].map((body) => <PushOnMount key={body} body={body} />)}
      </ToastProvider>,
    );

    expect(queryAlerts().map((toast) => toast.textContent)).toEqual(['three', 'four', 'five']);
  });
});

describe('Toast eviction, session and lane', () => {
  it('keeps the focused toast when newer ones would evict it', () => {
    const toasts = (bodies: string[]) => (
      <ToastProvider>
        {bodies.map((body) => <PushOnMount key={body} body={body} />)}
        <button type="button">elsewhere</button>
      </ToastProvider>
    );
    const { rerender } = renderWithProviders(toasts(['one', 'two', 'three']));
    const dismissOne = within(queryAlerts()[0]).getByRole('button', { name: 'Common.action.dismiss' });
    act(() => dismissOne.focus());

    rerender(toasts(['one', 'two', 'three', 'four']));

    expect(queryAlerts().map((toast) => toast.textContent)).toEqual(['one', 'three', 'four']);
    expect(dismissOne).toHaveFocus();
  });

  it('removes session toasts when the session ends and keeps the rest', () => {
    renderWithProviders(
      <ToastProvider>
        <PushOnMount body="private message" sessionScoped />
        <PushOnMount body="password changed" />
      </ToastProvider>,
    );

    act(() => endSession());

    expect(queryAlerts().map((toast) => toast.textContent)).toEqual(['password changed']);
  });

  it('moves the toast lane off the deck editor top controls', () => {
    expect(toastLaneFor('/room/1')).toBe('top');
    expect(toastLaneFor('/deck/12')).toBe('bottom');
    expect(toastLaneFor('/deck/draft/abc')).toBe('bottom');
  });
});

describe('Toast auto-hide pause', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops the countdown while hovered and resumes with the time that was left', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderWithProviders(<Toast open autoHideDuration={3000} onClose={onClose}>hover me</Toast>);
    const toast = screen.getByTestId('toast');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.mouseEnter(toast);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stops the countdown while focus is inside', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderWithProviders(<Toast open autoHideDuration={1000} onClose={onClose}>focus me</Toast>);

    act(() => {
      screen.getByRole('button', { name: 'Common.action.dismiss' }).focus();
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      screen.getByRole('button', { name: 'Common.action.dismiss' }).blur();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Toast reducer', () => {
  it('ADD_TOAST inserts a closed entry and increments refs on duplicate keys', () => {
    const afterAdd = reducer(initialState, {
      type: ACTIONS.ADD_TOAST,
      payload: { key: 'k', children: 'one' },
    });
    expect(afterAdd.toasts.k).toEqual({ isOpen: false, children: 'one', refs: 1 });

    const afterSecond = reducer(afterAdd, {
      type: ACTIONS.ADD_TOAST,
      payload: { key: 'k', children: 'ignored' },
    });
    expect(afterSecond.toasts.k.refs).toBe(2);
    expect(afterSecond.toasts.k.children).toBe('one');
  });

  it('OPEN_TOAST / CLOSE_TOAST flip isOpen for an existing entry', () => {
    const seeded = reducer(initialState, {
      type: ACTIONS.ADD_TOAST,
      payload: { key: 'k', children: 'body' },
    });
    const opened = reducer(seeded, { type: ACTIONS.OPEN_TOAST, payload: { key: 'k' } });
    expect(opened.toasts.k.isOpen).toBe(true);
    const closed = reducer(opened, { type: ACTIONS.CLOSE_TOAST, payload: { key: 'k' } });
    expect(closed.toasts.k.isOpen).toBe(false);
  });

  it('OPEN_TOAST upserts a missing key instead of silently no-op', () => {
    const state = reducer(initialState, {
      type: ACTIONS.OPEN_TOAST,
      payload: { key: 'k', children: 'hi' },
    });
    expect(state.toasts.k).toEqual({ isOpen: true, children: 'hi', refs: 1 });
  });

  it('OPEN_TOAST overrides content when children are passed at fire time', () => {
    const seeded = reducer(initialState, { type: ACTIONS.ADD_TOAST, payload: { key: 'k', children: 'old' } });
    const opened = reducer(seeded, { type: ACTIONS.OPEN_TOAST, payload: { key: 'k', children: 'new' } });
    expect(opened.toasts.k.children).toBe('new');
    expect(opened.toasts.k.isOpen).toBe(true);
    expect(opened.toasts.k.refs).toBe(1);
  });

  it('UPDATE_TOAST no-ops on a missing key and returns the same state reference', () => {
    const state = reducer(initialState, { type: ACTIONS.UPDATE_TOAST, payload: { key: 'k', children: 'x' } });
    expect(state).toBe(initialState);
  });

  it('UPDATE_TOAST refreshes content on an existing key without touching isOpen or refs', () => {
    const opened = reducer(initialState, { type: ACTIONS.OPEN_TOAST, payload: { key: 'k', children: 'en' } });
    const updated = reducer(opened, { type: ACTIONS.UPDATE_TOAST, payload: { key: 'k', children: 'fr' } });
    expect(updated.toasts.k.children).toBe('fr');
    expect(updated.toasts.k.isOpen).toBe(true);
    expect(updated.toasts.k.refs).toBe(1);
  });

  it('UPDATE_TOAST returns the same state reference when content is unchanged (churn guard)', () => {
    const seeded = reducer(initialState, { type: ACTIONS.ADD_TOAST, payload: { key: 'k', children: 'same' } });
    const updated = reducer(seeded, { type: ACTIONS.UPDATE_TOAST, payload: { key: 'k', children: 'same' } });
    expect(updated).toBe(seeded);
  });

  it('REMOVE_TOAST decrements refs first and finally deletes the entry', () => {
    let state = reducer(initialState, {
      type: ACTIONS.ADD_TOAST,
      payload: { key: 'k', children: 'body' },
    });
    state = reducer(state, {
      type: ACTIONS.ADD_TOAST,
      payload: { key: 'k', children: 'body' },
    });
    expect(state.toasts.k.refs).toBe(2);

    state = reducer(state, { type: ACTIONS.REMOVE_TOAST, payload: { key: 'k' } });
    expect(state.toasts.k.refs).toBe(1);

    state = reducer(state, { type: ACTIONS.REMOVE_TOAST, payload: { key: 'k' } });
    expect(state.toasts.k).toBeUndefined();
  });
});
