import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export const ACTIONS = {
  ADD_TOAST: 'ADD_TOAST',
  OPEN_TOAST: 'OPEN_TOAST',
  CLOSE_TOAST: 'CLOSE_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
} as const;

export interface ToastEntry {
  isOpen: boolean;
  children: ReactNode;
  refs: number;
  // Optional icon override — passed straight through to Toast. Null
  // means "use severity default" (which today is a green checkmark).
  icon?: LucideIcon;
}

export interface ToastState {
  toasts: Record<string, ToastEntry>;
}

export const initialState: ToastState = {
  toasts: {},
};

export type ToastAction =
  | { type: typeof ACTIONS.ADD_TOAST; payload: { key: string; children: ReactNode; icon?: LucideIcon } }
  | { type: typeof ACTIONS.OPEN_TOAST; payload: { key: string; children?: ReactNode; icon?: LucideIcon } }
  | { type: typeof ACTIONS.UPDATE_TOAST; payload: { key: string; children: ReactNode; icon?: LucideIcon } }
  | { type: typeof ACTIONS.CLOSE_TOAST; payload: { key: string } }
  | { type: typeof ACTIONS.REMOVE_TOAST; payload: { key: string } };

export function reducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case ACTIONS.ADD_TOAST: {
      const { key, children, icon } = action.payload;
      const existing = state.toasts[key];
      return {
        ...state,
        toasts: {
          ...state.toasts,
          [key]: existing
            ? { ...existing, refs: existing.refs + 1 }
            : { isOpen: false, children, refs: 1, icon },
        },
      };
    }
    case ACTIONS.OPEN_TOAST: {
      const { key, children, icon } = action.payload;
      const existing = state.toasts[key];
      // Upsert so open never silently no-ops: if the entry was lost (e.g. a
      // language-change Suspense teardown removed it) or the caller passes
      // fresh content, (re)create/update it here, then open.
      const next: ToastEntry = existing
        ? {
          ...existing,
          children: children !== undefined ? children : existing.children,
          icon: icon ?? existing.icon,
          isOpen: true,
        }
        : { isOpen: true, children, refs: 1, icon };
      return { ...state, toasts: { ...state.toasts, [key]: next } };
    }
    case ACTIONS.UPDATE_TOAST: {
      const { key, children, icon } = action.payload;
      const existing = state.toasts[key];
      // Registration (ADD_TOAST) owns creation; a stray update for an
      // unregistered key is a no-op. Skip unchanged content so a stable t()
      // string never churns provider state.
      if (!existing || (Object.is(existing.children, children) && existing.icon === (icon ?? existing.icon))) {
        return state;
      }
      return {
        ...state,
        toasts: { ...state.toasts, [key]: { ...existing, children, icon: icon ?? existing.icon } },
      };
    }
    case ACTIONS.CLOSE_TOAST: {
      const { key } = action.payload;
      const existing = state.toasts[key];
      if (!existing) {
        return state;
      }
      return {
        ...state,
        toasts: { ...state.toasts, [key]: { ...existing, isOpen: false } },
      };
    }
    case ACTIONS.REMOVE_TOAST: {
      const { key } = action.payload;
      const existing = state.toasts[key];
      if (!existing) {
        return state;
      }
      if (existing.refs > 1) {
        return {
          ...state,
          toasts: { ...state.toasts, [key]: { ...existing, refs: existing.refs - 1 } },
        };
      }
      const nextToasts = { ...state.toasts };
      delete nextToasts[key];
      return { ...state, toasts: nextToasts };
    }
    default:
      return state;
  }
}
