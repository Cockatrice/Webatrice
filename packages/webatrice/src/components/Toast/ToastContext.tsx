import { createContext, FC, PropsWithChildren, ReactNode, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';

import { ACTIONS, initialState, reducer, ToastEntry } from './reducer';
import Toast from './Toast';

export interface PushToastOptions {
  // Icon override for the toast pill. Defaults to the severity icon
  // (CheckCircle for the default 'success' severity), which reads as
  // an odd choice for e.g. incoming chat pings — pass MessageSquare.
  icon?: LucideIcon;
}

interface ToastContextValue {
  toasts: Record<string, ToastEntry>;
  addToast: (key: string, children: ReactNode) => void;
  updateToast: (key: string, children: ReactNode) => void;
  openToast: (key: string, children?: ReactNode) => void;
  closeToast: (key: string) => void;
  removeToast: (key: string) => void;
  // Imperative "fire-and-forget" toast for one-off notifications (e.g.
  // incoming private-chat messages). Generates a unique key so the
  // caller doesn't have to coordinate, adds + opens in one step, and
  // returns a `close()` for early dismissal. The pill self-removes
  // when the toast component's autoHideDuration elapses via the
  // handler below.
  pushToast: (children: ReactNode, options?: PushToastOptions) => { key: string; close: () => void };
}

const ToastContext = createContext<ToastContextValue>({
  toasts: {},
  addToast: () => {},
  updateToast: () => {},
  openToast: () => {},
  closeToast: () => {},
  removeToast: () => {},
  pushToast: () => ({ key: '', close: () => {} }),
});

export const ToastProvider: FC<PropsWithChildren> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Monotonic counter so successive `pushToast` calls within the same
  // millisecond don't collide on the timestamp part of the key.
  const pushCounter = useRef(0);
  const pushToast = useCallback((toastChildren: ReactNode, options?: PushToastOptions) => {
    pushCounter.current += 1;
    const key = `push:${Date.now()}:${pushCounter.current}`;
    dispatch({ type: ACTIONS.ADD_TOAST, payload: { key, children: toastChildren, icon: options?.icon } });
    dispatch({ type: ACTIONS.OPEN_TOAST, payload: { key } });
    // Remove the entry entirely after the auto-hide window (Toast
    // defaults to 10s) plus a small buffer for the slide-out
    // transition. Without this, imperative toasts accumulate in
    // reducer state indefinitely.
    window.setTimeout(() => {
      dispatch({ type: ACTIONS.REMOVE_TOAST, payload: { key } });
    }, 11_000);
    return {
      key,
      close: () => dispatch({ type: ACTIONS.CLOSE_TOAST, payload: { key } }),
    };
  }, []);
  const providerState: ToastContextValue = {
    toasts: state.toasts,
    addToast: (key, toastChildren) => dispatch({ type: ACTIONS.ADD_TOAST, payload: { key, children: toastChildren } }),
    updateToast: (key, toastChildren) => dispatch({ type: ACTIONS.UPDATE_TOAST, payload: { key, children: toastChildren } }),
    openToast: (key, toastChildren) => {
      if (import.meta.env.DEV && toastChildren === undefined && !state.toasts[key]) {
        console.warn(`[toast] openToast("${key}") before registration — nothing to show`);
      }
      dispatch({ type: ACTIONS.OPEN_TOAST, payload: { key, children: toastChildren } });
    },
    closeToast: (key) => dispatch({ type: ACTIONS.CLOSE_TOAST, payload: { key } }),
    removeToast: (key) => dispatch({ type: ACTIONS.REMOVE_TOAST, payload: { key } }),
    pushToast,
  };
  // Toasts render into a single fixed portal at bottom-right of the
  // viewport, stacked with a small gap. Pre-redo, each MUI Snackbar
  // portalled itself and stacked implicitly by z-index; the new
  // Toast component is a plain pill with no positioning of its own,
  // so this container is what puts them on-screen.
  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <ToastContext.Provider value={providerState}>
      {children}
      {portalTarget &&
        createPortal(
          <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
            {Object.entries(state.toasts).map(([key, entry]) => (
              <Toast
                key={key}
                open={entry.isOpen}
                onClose={() => dispatch({ type: ACTIONS.CLOSE_TOAST, payload: { key } })}
                icon={entry.icon}
              >
                {entry.children}
              </Toast>
            ))}
          </div>,
          portalTarget,
        )}
    </ToastContext.Provider>
  );
};

export interface ToastHookOptions {
  key: string;
  // Optional: fire-time-only callers (e.g. KnownHosts) omit this and pass the
  // content to `openToast(children)` instead, so the toast always shows the
  // current-language text rather than whatever was rendered at mount.
  children?: ReactNode;
}

export interface ToastHandle {
  openToast: (children?: ReactNode) => void;
  closeToast: () => void;
  removeToast: () => void;
}

export function useToast({ key, children }: ToastHookOptions): ToastHandle {
  const { addToast, updateToast, openToast, closeToast, removeToast } = useContext(ToastContext);

  // Reserve the key for this component's lifetime: create the entry on mount,
  // remove it on unmount. Keyed on `key` only so remount churn stays minimal.
  // `children` is intentionally excluded: registration is a mount/unmount
  // lifecycle keyed on `key`. Content is refreshed by the effect below.
  useEffect(() => {
    addToast(key, children);
    return () => {
      removeToast(key);
    };
  }, [key]);

  // Keep the registered content current: a language change re-renders with a new
  // `t()` string, so refresh the stored children (the reducer skips no-op
  // updates, so a stable string never churns provider state). Callers that pass
  // content at fire time via `openToast(children)` don't rely on this.
  useEffect(() => {
    updateToast(key, children);
  }, [key, children]);

  return {
    openToast: (toastChildren) => openToast(key, toastChildren),
    closeToast: () => closeToast(key),
    removeToast: () => removeToast(key),
  };
}

// Fire-and-forget toast dispatcher. Returns a stable function that
// creates a fresh toast per call (unique key generated internally) and
// opens it immediately. Use for one-off notifications the caller
// doesn't need to control after the fact (e.g. incoming private-chat
// message pings). Prefer `useToast` when the toast is bound to a
// specific piece of UI state that opens/closes it.
export function usePushToast(): (children: ReactNode, options?: PushToastOptions) => { key: string; close: () => void } {
  const { pushToast } = useContext(ToastContext);
  return pushToast;
}
