import { createContext, useContext, type Provider } from 'react';

// Factory for the common game-context shape: a value provided once near the top
// of the tree and read by descendants, where a missing provider is a wiring bug
// rather than a valid (e.g. pre-game) state. Returns the Provider plus a hook
// that narrows the value to non-null and throws a named error otherwise.
//
// `name` is the context's display name (shown in React DevTools and the thrown
// error). Use this for the uniform throw-if-absent contexts; contexts that need
// an optional variant (GameIdContext) or a bespoke memoizing provider
// (CardVisualStateContext) keep their hand-written form.
export function createRequiredContext<T>(name: string): readonly [Provider<T | null>, () => T] {
  const Context = createContext<T | null>(null);
  Context.displayName = name;

  function useRequiredContext(): T {
    const ctx = useContext(Context);
    if (ctx == null) {
      throw new Error(`${name} is missing — render this subtree inside its provider`);
    }
    return ctx;
  }

  return [Context.Provider, useRequiredContext] as const;
}
