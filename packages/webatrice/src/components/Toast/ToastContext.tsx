import { createContext, FC, PropsWithChildren, ReactNode, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';

import { onSessionEnd } from '@app/services/session';

import { ACTIONS, initialState, reducer, ToastEntry } from './reducer';
import Toast, { type ToastActionButton, type ToastSeverity } from './Toast';
import { useToastLane } from './toastLane';

export interface PushToastOptions {
  icon?: LucideIcon;
  severity?: ToastSeverity;
  lead?: ReactNode;
  action?: ToastActionButton;
  sessionScoped?: boolean;
}

interface ToastContextValue {
  toasts: Record<string, ToastEntry>;
  addToast: (key: string, children: ReactNode) => void;
  updateToast: (key: string, children: ReactNode) => void;
  openToast: (key: string, children?: ReactNode) => void;
  closeToast: (key: string) => void;
  removeToast: (key: string) => void;
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
  const pushCounter = useRef(0);
  const focusedKey = useRef<string | null>(null);
  useEffect(() => onSessionEnd(() => dispatch({ type: ACTIONS.REMOVE_SESSION_TOASTS })), []);
  const pushToast = useCallback((toastChildren: ReactNode, options?: PushToastOptions) => {
    pushCounter.current += 1;
    const key = `push:${Date.now()}:${pushCounter.current}`;
    dispatch({
      type: ACTIONS.ADD_TOAST,
      payload: {
        key,
        children: toastChildren,
        icon: options?.icon,
        severity: options?.severity,
        lead: options?.lead,
        action: options?.action,
        sessionScoped: options?.sessionScoped,
        pushed: true,
        keep: focusedKey.current,
      },
    });
    dispatch({ type: ACTIONS.OPEN_TOAST, payload: { key } });
    return {
      key,
      close: () => dispatch({ type: ACTIONS.REMOVE_TOAST, payload: { key } }),
    };
  }, []);
  const addToast = useCallback((key: string, toastChildren: ReactNode) => {
    dispatch({ type: ACTIONS.ADD_TOAST, payload: { key, children: toastChildren } });
  }, []);
  const updateToast = useCallback((key: string, toastChildren: ReactNode) => {
    dispatch({ type: ACTIONS.UPDATE_TOAST, payload: { key, children: toastChildren } });
  }, []);
  const closeToast = useCallback((key: string) => dispatch({ type: ACTIONS.CLOSE_TOAST, payload: { key } }), []);
  const removeToast = useCallback((key: string) => dispatch({ type: ACTIONS.REMOVE_TOAST, payload: { key } }), []);
  const providerState: ToastContextValue = {
    toasts: state.toasts,
    addToast,
    updateToast,
    openToast: (key, toastChildren) => {
      if (import.meta.env.DEV && toastChildren === undefined && !state.toasts[key]) {
        console.warn(`[toast] openToast("${key}") before registration — nothing to show`);
      }
      dispatch({ type: ACTIONS.OPEN_TOAST, payload: { key, children: toastChildren } });
    },
    closeToast,
    removeToast,
    pushToast,
  };
  const { t } = useTranslation();
  const lane = useToastLane();
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  const entries = Object.entries(state.toasts);
  const renderToast = ([key, entry]: [string, ToastEntry]) => (
    <Toast
      key={key}
      open={entry.isOpen}
      onClose={() => dispatch({ type: entry.pushed ? ACTIONS.REMOVE_TOAST : ACTIONS.CLOSE_TOAST, payload: { key } })}
      icon={entry.icon}
      severity={entry.severity}
      lead={entry.lead}
      action={entry.action}
      onFocusChange={(focused) => {
        focusedKey.current = focused ? key : focusedKey.current === key ? null : focusedKey.current;
      }}
    >
      {entry.children}
    </Toast>
  );

  return (
    <ToastContext.Provider value={providerState}>
      {children}
      {portalTarget &&
        createPortal(
          <section
            aria-label={t('Toast.region')}
            data-lane={lane}
            data-modal-exempt
            className={[
              'pointer-events-none fixed inset-x-0 z-40 flex flex-col items-center gap-2 px-4',
              lane === 'top' ? 'top-[52px]' : 'bottom-6',
            ].join(' ')}
          >
            <div aria-live="assertive" className="flex flex-col items-center gap-2">
              {entries.filter(([, entry]) => entry.severity === 'error').map(renderToast)}
            </div>
            <div aria-live="polite" className="flex flex-col items-center gap-2">
              {entries.filter(([, entry]) => entry.severity !== 'error').map(renderToast)}
            </div>
          </section>,
          portalTarget,
        )}
    </ToastContext.Provider>
  );
};

export interface ToastHookOptions {
  key: string;
  children?: ReactNode;
}

export interface ToastHandle {
  openToast: (children?: ReactNode) => void;
  closeToast: () => void;
  removeToast: () => void;
}

export function useToast({ key, children }: ToastHookOptions): ToastHandle {
  const { addToast, updateToast, openToast, closeToast, removeToast } = useContext(ToastContext);

  useEffect(() => {
    addToast(key, children);
    return () => {
      removeToast(key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registration is keyed on `key`; `children` refreshes below
  }, [key, addToast, removeToast]);

  useEffect(() => {
    updateToast(key, children);
  }, [key, children, updateToast]);

  return {
    openToast: (toastChildren) => openToast(key, toastChildren),
    closeToast: () => closeToast(key),
    removeToast: () => removeToast(key),
  };
}

export function usePushToast(): (children: ReactNode, options?: PushToastOptions) => { key: string; close: () => void } {
  const { pushToast } = useContext(ToastContext);
  return pushToast;
}
