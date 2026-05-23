import { act, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';

import { renderWithProviders } from '../../__test-utils__';
import Toast from './Toast';
import { ToastProvider, useToast } from './ToastContext';
import { ACTIONS, initialState, reducer } from './reducer';

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
      <button type="button" onClick={openToast}>open-{messageKey}</button>
      <button type="button" onClick={closeToast}>close-{messageKey}</button>
    </div>
  );
}

function AutoOpen({ messageKey, body }: { messageKey: string; body: string }) {
  const { openToast } = useToast({ key: messageKey, children: body });
  useEffect(() => {
    openToast();
  }, []);
  return null;
}

function queryAlerts(): HTMLElement[] {
  return screen.queryAllByRole('alert');
}

describe('Toast component', () => {
  it('renders an alert element when open and removes it when closed', async () => {
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
    const closeButton = await screen.findByRole('button', { name: /close/i });
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
