import type { DockedChat } from '@app/hooks';

export function splitDock(chats: readonly DockedChat[], selfName: string | null): { windows: DockedChat[]; bars: DockedChat[] } {
  const others = chats.filter((chat) => chat.name !== selfName);
  return {
    windows: others.filter((chat) => chat.expanded),
    bars: others.filter((chat) => !chat.expanded),
  };
}

export type DockFocusTarget = { kind: 'bar' | 'input'; name: string } | 'opener';

export function focusAfterClose(windows: readonly DockedChat[], bars: readonly DockedChat[], name: string): DockFocusTarget {
  const windowIndex = windows.findIndex((chat) => chat.name === name);
  const barIndex = bars.findIndex((chat) => chat.name === name);
  const otherWindows = windows.filter((chat) => chat.name !== name);
  const otherBars = bars.filter((chat) => chat.name !== name);
  if (windowIndex >= 0) {
    const neighbour = otherWindows[windowIndex - 1] ?? otherWindows[windowIndex];
    if (neighbour) {
      return { kind: 'input', name: neighbour.name };
    }
    return otherBars[0] ? { kind: 'bar', name: otherBars[0].name } : 'opener';
  }
  if (barIndex >= 0) {
    const neighbour = otherBars[barIndex] ?? otherBars[barIndex - 1];
    if (neighbour) {
      return { kind: 'bar', name: neighbour.name };
    }
    const last = otherWindows.at(-1);
    return last ? { kind: 'input', name: last.name } : 'opener';
  }
  return 'opener';
}
