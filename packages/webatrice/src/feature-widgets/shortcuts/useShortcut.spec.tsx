import { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';

import { ShortcutContext, ShortcutContextValue } from './shortcutContext';
import { useShortcut, useShortcutGroup } from './useShortcut';
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
    const register = vi.fn<ShortcutContextValue['register']>(() => unregister);
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
    const register = vi.fn<ShortcutContextValue['register']>(() => unregister);
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
    const register = vi.fn<ShortcutContextValue['register']>(() => () => {});
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
    const register = vi.fn<ShortcutContextValue['register']>(() => unregister);
    const wrapper = makeWrapper(register);

    const { unmount } = renderHook(
      () => useShortcut('chat.focus', vi.fn(), { scope: ShortcutScope.GLOBAL }),
      { wrapper },
    );

    unmount();
    expect(unregister).toHaveBeenCalledTimes(1);
  });
});

describe('useShortcutGroup', () => {
  const GROUP = ['game.incP', 'game.decP'] as const;

  it('registers every action once and passes the action id and its index to the latest handler', () => {
    const unregister = vi.fn();
    const register = vi.fn<ShortcutContextValue['register']>(() => unregister);
    const first = vi.fn();
    const second = vi.fn();
    const wrapper = makeWrapper(register);

    const { rerender, unmount } = renderHook(
      ({ handler }: { handler: (actionId: string, event: KeyboardEvent, index: number) => void }) =>
        useShortcutGroup(GROUP, handler, { scope: ShortcutScope.GAME, preventDefault: false }),
      { wrapper, initialProps: { handler: first } },
    );
    rerender({ handler: second });

    expect(register.mock.calls.map(([reg]) => [reg.actionId, reg.scope, reg.preventDefault])).toEqual([
      ['game.incP', ShortcutScope.GAME, false],
      ['game.decP', ShortcutScope.GAME, false],
    ]);
    const event = new KeyboardEvent('keydown');
    register.mock.calls[1][0].handler(event);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('game.decP', event, 1);

    unmount();
    expect(unregister).toHaveBeenCalledTimes(2);
  });

  it('does not register when enabled=false', () => {
    const register = vi.fn<ShortcutContextValue['register']>(() => () => {});
    renderHook(() => useShortcutGroup(GROUP, vi.fn(), { scope: ShortcutScope.GAME, enabled: false }), {
      wrapper: makeWrapper(register),
    });
    expect(register).not.toHaveBeenCalled();
  });
});
