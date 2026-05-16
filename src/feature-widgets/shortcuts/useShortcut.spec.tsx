import { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';

import { ShortcutContext, ShortcutContextValue } from './shortcutContext';
import { useShortcut } from './useShortcut';
import { ShortcutScope } from './types';

function makeWrapper(register: ShortcutContextValue['register']) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ShortcutContext.Provider value={{ register }}>{children}</ShortcutContext.Provider>
    );
  };
}

describe('useShortcut', () => {
  it('registers with the active scope, actionId, and preventDefault=true by default', () => {
    const unregister = vi.fn();
    const register = vi.fn(() => unregister);
    const handler = vi.fn();
    const wrapper = makeWrapper(register);

    renderHook(() => useShortcut('game.drawCard', handler, { scope: ShortcutScope.GAME }), {
      wrapper,
    });

    expect(register).toHaveBeenCalledTimes(1);
    const reg = register.mock.calls[0][0];
    expect(reg.actionId).toBe('game.drawCard');
    expect(reg.scope).toBe(ShortcutScope.GAME);
    expect(reg.preventDefault).toBe(true);
  });

  it('invokes the latest handler via a stable ref on key event', () => {
    const unregister = vi.fn();
    const register = vi.fn(() => unregister);
    const first = vi.fn();
    const second = vi.fn();

    const wrapper = makeWrapper(register);
    const { rerender } = renderHook(
      ({ handler }: { handler: (event: KeyboardEvent) => void }) =>
        useShortcut('game.drawCard', handler, { scope: ShortcutScope.GAME }),
      { wrapper, initialProps: { handler: first } },
    );

    rerender({ handler: second });

    const event = new KeyboardEvent('keydown');
    register.mock.calls[0][0].handler(event);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(event);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('does not register when enabled=false', () => {
    const register = vi.fn(() => () => {});
    const wrapper = makeWrapper(register);

    renderHook(
      () =>
        useShortcut('game.drawCard', vi.fn(), {
          scope: ShortcutScope.GAME,
          enabled: false,
        }),
      { wrapper },
    );

    expect(register).not.toHaveBeenCalled();
  });

  it('calls the unregister function returned by register on unmount', () => {
    const unregister = vi.fn();
    const register = vi.fn(() => unregister);
    const wrapper = makeWrapper(register);

    const { unmount } = renderHook(
      () => useShortcut('chat.focus', vi.fn(), { scope: ShortcutScope.GLOBAL }),
      { wrapper },
    );

    unmount();
    expect(unregister).toHaveBeenCalledTimes(1);
  });
});
