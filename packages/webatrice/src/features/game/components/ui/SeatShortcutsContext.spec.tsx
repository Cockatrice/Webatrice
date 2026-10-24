import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  SeatShortcutsProvider,
  createSeatShortcutRegistry,
  usePublishSeatShortcuts,
  type SeatShortcutOperations,
  type SeatShortcutRegistry,
} from './SeatShortcutsContext';

function wrapperFor(registry: SeatShortcutRegistry) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SeatShortcutsProvider registry={registry}>{children}</SeatShortcutsProvider>;
  };
}

describe('createSeatShortcutRegistry', () => {
  it('runs nothing until a seat publishes, and nothing after it withdraws', () => {
    const registry = createSeatShortcutRegistry();
    const incP = vi.fn();
    expect(registry.run('game.incP')).toBe(false);

    const withdraw = registry.publish(() => ({ 'game.incP': incP }));
    expect(registry.run('game.incP')).toBe(true);
    expect(registry.run('game.decP')).toBe(false);
    expect(incP).toHaveBeenCalledTimes(1);

    withdraw();
    expect(registry.run('game.incP')).toBe(false);
  });

  it('keeps a newer publisher when an older one withdraws', () => {
    const registry = createSeatShortcutRegistry();
    const older = vi.fn();
    const newer = vi.fn();
    const withdrawOlder = registry.publish(() => ({ 'game.incP': older }));
    registry.publish(() => ({ 'game.incP': newer }));

    withdrawOlder();
    registry.run('game.incP');
    expect(older).not.toHaveBeenCalled();
    expect(newer).toHaveBeenCalledTimes(1);
  });
});

describe('usePublishSeatShortcuts', () => {
  it('publishes the latest render while non-null and withdraws on null or unmount', () => {
    const registry = createSeatShortcutRegistry();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ ops }: { ops: SeatShortcutOperations | null }) => usePublishSeatShortcuts(ops),
      { wrapper: wrapperFor(registry), initialProps: { ops: { 'game.setLife': first } as SeatShortcutOperations | null } },
    );

    rerender({ ops: { 'game.setLife': second } });
    registry.run('game.setLife');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    rerender({ ops: null });
    expect(registry.run('game.setLife')).toBe(false);

    rerender({ ops: { 'game.setLife': second } });
    expect(registry.run('game.setLife')).toBe(true);
    unmount();
    expect(registry.run('game.setLife')).toBe(false);
  });
});
