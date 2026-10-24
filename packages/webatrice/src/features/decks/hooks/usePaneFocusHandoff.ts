import { useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';

type FocusRef = (node: HTMLElement | null) => void;

export function usePaneFocusHandoff() {
  const nodes = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, FocusRef>());

  const target = useCallback((key: string): FocusRef => {
    let ref = refs.current.get(key);
    if (!ref) {
      ref = (node) => {
        if (node) {
          nodes.current.set(key, node);
        } else {
          nodes.current.delete(key);
        }
      };
      refs.current.set(key, ref);
    }
    return ref;
  }, []);

  const updateThenFocus = useCallback((update: () => void, key: string) => {
    flushSync(update);
    nodes.current.get(key)?.focus();
  }, []);

  return { target, updateThenFocus };
}
