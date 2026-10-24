import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import type { ToastActionButton, ToastSeverity } from './Toast';

export const ACTIONS = {
  ADD_TOAST: 'ADD_TOAST',
  OPEN_TOAST: 'OPEN_TOAST',
  CLOSE_TOAST: 'CLOSE_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  REMOVE_SESSION_TOASTS: 'REMOVE_SESSION_TOASTS',
} as const;

export interface ToastEntry {
  isOpen: boolean;
  children: ReactNode;
  refs: number;
  icon?: LucideIcon;
  severity?: ToastSeverity;
  lead?: ReactNode;
  action?: ToastActionButton;
  pushed?: boolean;
  sessionScoped?: boolean;
}

export const MAX_PUSHED_TOASTS = 3;

export interface ToastState {
  toasts: Record<string, ToastEntry>;
}

export const initialState: ToastState = {
  toasts: {},
};

export type ToastAction =
  | {
    type: typeof ACTIONS.ADD_TOAST;
    payload: {
      key: string;
      children: ReactNode;
      icon?: LucideIcon;
      severity?: ToastSeverity;
      lead?: ReactNode;
      action?: ToastActionButton;
      pushed?: boolean;
      sessionScoped?: boolean;
      keep?: string | null;
    };
  }
  | { type: typeof ACTIONS.OPEN_TOAST; payload: { key: string; children?: ReactNode; icon?: LucideIcon } }
  | { type: typeof ACTIONS.UPDATE_TOAST; payload: { key: string; children: ReactNode; icon?: LucideIcon } }
  | { type: typeof ACTIONS.CLOSE_TOAST; payload: { key: string } }
  | { type: typeof ACTIONS.REMOVE_TOAST; payload: { key: string } }
  | { type: typeof ACTIONS.REMOVE_SESSION_TOASTS };

export function reducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case ACTIONS.ADD_TOAST: {
      const { key, children, icon, severity, lead, action: button, pushed, sessionScoped, keep } = action.payload;
      const existing = state.toasts[key];
      const toasts = {
        ...state.toasts,
        [key]: existing
          ? { ...existing, refs: existing.refs + 1 }
          : { isOpen: false, children, refs: 1, icon, severity, lead, action: button, pushed, sessionScoped },
      };
      if (pushed && !existing) {
        const pushedKeys = Object.keys(toasts).filter((k) => toasts[k].pushed);
        const excess = Math.max(0, pushedKeys.length - MAX_PUSHED_TOASTS);
        pushedKeys.filter((k) => k !== keep).slice(0, excess).forEach((k) => delete toasts[k]);
      }
      return { ...state, toasts };
    }
    case ACTIONS.OPEN_TOAST: {
      const { key, children, icon } = action.payload;
      const existing = state.toasts[key];
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
    case ACTIONS.REMOVE_SESSION_TOASTS: {
      const kept = Object.entries(state.toasts).filter(([, entry]) => !entry.sessionScoped);
      return kept.length === Object.keys(state.toasts).length ? state : { ...state, toasts: Object.fromEntries(kept) };
    }
    default:
      return state;
  }
}
