import { renderHook } from '@testing-library/react';
import { App } from '@app/types';

vi.mock('@app/hooks', async (orig) => {
  const actual = await orig<typeof import('@app/hooks')>();
  return {
    ...actual,
    useScryfallCard: () => ({ smallUrl: null }),
  };
});

const useDraggableMock = vi.fn();
vi.mock('@dnd-kit/core', () => ({
  useDraggable: (opts: unknown) => {
    useDraggableMock(opts);
    return { setNodeRef: vi.fn(), attributes: {}, listeners: {}, isDragging: false };
  },
}));

vi.mock('../CardRegistry/CardRegistryContext', () => ({
  makeCardKey: (p: number, z: string, c: number) => `${p}-${z}-${c}`,
  useRegisterCardRef: () => vi.fn(),
}));

import { makeCard } from '../../../store/game/__mocks__/fixtures';
import { useCardSlot } from './useCardSlot';

beforeEach(() => {
  useDraggableMock.mockClear();
});

describe('useCardSlot', () => {
  // Card slots are draggable but never act as drop targets — drag-drop on a
  // card falls through to the BattlefieldRow droppable so it stacks rather
  // than attaches (matches desktop, where attach is right-click-menu only).
  it('registers a draggable for an unattached TABLE card', () => {
    const card = makeCard({ id: 1 });
    renderHook(() =>
      useCardSlot({ card, draggable: true, ownerPlayerId: 1, zone: App.ZoneName.TABLE }),
    );
    expect(useDraggableMock).toHaveBeenCalledTimes(1);
    const dragCall = useDraggableMock.mock.calls[0][0] as { disabled: boolean };
    expect(dragCall.disabled).toBe(false);
  });

  it('disables the draggable when ownerPlayerId or zone is unknown', () => {
    const card = makeCard({ id: 2 });
    renderHook(() =>
      useCardSlot({ card, draggable: true, ownerPlayerId: undefined, zone: App.ZoneName.TABLE }),
    );
    const dragCall = useDraggableMock.mock.calls[0][0] as { disabled: boolean };
    expect(dragCall.disabled).toBe(true);
  });

  it('disables the draggable when the caller passes draggable=false', () => {
    const card = makeCard({ id: 3 });
    renderHook(() =>
      useCardSlot({ card, draggable: false, ownerPlayerId: 1, zone: App.ZoneName.TABLE }),
    );
    const dragCall = useDraggableMock.mock.calls[0][0] as { disabled: boolean };
    expect(dragCall.disabled).toBe(true);
  });
});
