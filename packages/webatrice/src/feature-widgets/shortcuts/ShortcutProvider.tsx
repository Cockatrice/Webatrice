import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { shortcuts, useAppDispatch, useAppSelector } from '@app/store';
import { ShortcutRegistration, ShortcutScope } from './types';
import { firesInTextInputsFor, getDefaultFor } from './defaults';
import {
  formatEvent,
  isModifierOnly,
  matchesEvent,
  normalizeSequence,
} from './shortcutSequence';
import { ShortcutContext, ShortcutContextValue } from './shortcutContext';
import { useShortcutsHydration } from './useShortcutsHydration';
import { useShortcutsPersistence } from './useShortcutsPersistence';


interface ShortcutProviderProps {
  children: ReactNode;
}

function computeRouteScope(pathname: string): ShortcutScope | null {
  if (pathname.startsWith('/game/')) {
    return ShortcutScope.GAME;
  }
  if (pathname === '/decks' || pathname.startsWith('/deck')) {
    return ShortcutScope.DECK_EDITOR;
  }
  if (pathname.startsWith('/room/')) {
    return ShortcutScope.ROOM;
  }
  if (pathname === '/replays') {
    return ShortcutScope.REPLAYS;
  }
  return null;
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  return target.isContentEditable;
}

export function ShortcutProvider({ children }: ShortcutProviderProps) {
  useShortcutsHydration();
  useShortcutsPersistence();

  const dispatch = useAppDispatch();
  const location = useLocation();
  const recordingActionId = useAppSelector(shortcuts.Selectors.getRecordingActionId);
  const overrides = useAppSelector(shortcuts.Selectors.getOverrides);

  const registry = useRef<Map<string, ShortcutRegistration[]>>(new Map());

  const recordingRef = useRef(recordingActionId);
  recordingRef.current = recordingActionId;
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  const register = useCallback((reg: ShortcutRegistration) => {
    const list = registry.current.get(reg.actionId) ?? [];
    list.push(reg);
    registry.current.set(reg.actionId, list);
    return () => {
      const cur = registry.current.get(reg.actionId);
      if (!cur) {
        return;
      }
      const idx = cur.lastIndexOf(reg);
      if (idx >= 0) {
        cur.splice(idx, 1);
      }
      if (cur.length === 0) {
        registry.current.delete(reg.actionId);
      }
    };
  }, []);

  const contextValue = useMemo<ShortcutContextValue>(
    () => ({ register }),
    [register],
  );

  useEffect(() => {
    const sequencesFor = (actionId: string): string[] =>
      overridesRef.current[actionId] ?? getDefaultFor(actionId)?.sequences ?? [];

    const tryFire = (regs: ShortcutRegistration[], event: KeyboardEvent): boolean => {
      for (let i = regs.length - 1; i >= 0; i--) {
        const reg = regs[i];
        if (isTextInputTarget(event.target) && !firesInTextInputsFor(reg.actionId)) {
          continue;
        }
        for (const seq of sequencesFor(reg.actionId)) {
          if (matchesEvent(seq, event)) {
            if (reg.preventDefault !== false) {
              event.preventDefault();
            }
            reg.handler(event);
            return true;
          }
        }
      }
      return false;
    };

    const handler = (event: KeyboardEvent) => {
      if (recordingRef.current) {
        if (event.code === 'Escape') {
          dispatch(shortcuts.Actions.cancelRecording());
        } else if (!isModifierOnly(event)) {
          dispatch(shortcuts.Actions.appendCapturedSequence({ sequence: normalizeSequence(formatEvent(event)) }));
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const activeRoute = computeRouteScope(pathnameRef.current);

      const candidates: ShortcutRegistration[] = [];
      for (const list of registry.current.values()) {
        for (const reg of list) {
          if (reg.scope === ShortcutScope.GLOBAL || reg.scope === activeRoute) {
            candidates.push(reg);
          }
        }
      }
      tryFire(candidates, event);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch]);

  return <ShortcutContext.Provider value={contextValue}>{children}</ShortcutContext.Provider>;
}
