import { renderHook } from '@testing-library/react';
import { Enriched } from '@cockatrice/datatrice';
vi.mock('@app/hooks', async (orig) => {
  const actual = await orig<typeof import('@app/hooks')>();
  return {
    ...actual,
    useScryfallCard: () => ({ smallUrl: null }),
  };
});

const useDraggableMock = vi.fn();
const useDroppableMock = vi.fn();
let droppableState: { isOver: boolean; active: { data: { current: unknown } } | null } = {
  isOver: false,
  active: null,
};
vi.mock('@dnd-kit/core', () => ({
  useDraggable: (opts: unknown) => {
    useDraggableMock(opts);
    return { setNodeRef: vi.fn(), attributes: {}, listeners: {}, isDragging: false };
  },
  useDroppable: (opts: unknown) => {
    useDroppableMock(opts);
    return { setNodeRef: vi.fn(), ...droppableState };
  },
}));

vi.mock('../CardRegistry/CardRegistryContext', () => ({
  makeCardKey: (p: number, z: string, c: number) => `${p}-${z}-${c}`,
  useRegisterCardRef: () => vi.fn(),
}));

import { makeCard } from '@cockatrice/datatrice/testing';
import { useCardSlot } from './useCardSlot';

beforeEach(() => {
  useDraggableMock.mockClear();
  useDroppableMock.mockClear();
  droppableState = { isOver: false, active: null };
});

describe('useCardSlot', () => {
  // Card slots are draggable but never act as drop targets — drag-drop on a
  // card falls through to the BattlefieldRow droppable so it stacks rather
  // than attaches (matches desktop, where attach is right-click-menu only).
  it('registers a draggable for an unattached TABLE card', () => {
    const card = makeCard({ id: 1 });
    renderHook(() =>
      useCardSlot({ card, draggable: true, ownerPlayerId: 1, zone: Enriched.ZoneName.TABLE }),
    );
    expect(useDraggableMock).toHaveBeenCalledTimes(1);
    const dragCall = useDraggableMock.mock.calls[0][0] as { disabled: boolean };
    expect(dragCall.disabled).toBe(false);
  });

  it('disables the draggable when ownerPlayerId or zone is unknown', () => {
    const card = makeCard({ id: 2 });
    renderHook(() =>
      useCardSlot({ card, draggable: true, ownerPlayerId: undefined, zone: Enriched.ZoneName.TABLE }),
    );
    const dragCall = useDraggableMock.mock.calls[0][0] as { disabled: boolean };
    expect(dragCall.disabled).toBe(true);
  });

  it('disables the draggable when the caller passes draggable=false', () => {
    const card = makeCard({ id: 3 });
    renderHook(() =>
      useCardSlot({ card, draggable: false, ownerPlayerId: 1, zone: Enriched.ZoneName.TABLE }),
    );
    const dragCall = useDraggableMock.mock.calls[0][0] as { disabled: boolean };
    expect(dragCall.disabled).toBe(true);
  });

  it('disables the droppable when no dropIndex is provided (TABLE)', () => {
    const card = makeCard({ id: 4 });
    renderHook(() =>
      useCardSlot({ card, draggable: true, ownerPlayerId: 1, zone: Enriched.ZoneName.TABLE }),
    );
    const dropCall = useDroppableMock.mock.calls[0][0] as { disabled: boolean };
    expect(dropCall.disabled).toBe(true);
  });

  it('registers a droppable with the slot index when dropIndex is provided', () => {
    const card = makeCard({ id: 5 });
    renderHook(() =>
      useCardSlot({ card, draggable: true, ownerPlayerId: 7, zone: Enriched.ZoneName.HAND, dropIndex: 3 }),
    );
    const dropCall = useDroppableMock.mock.calls[0][0] as {
      disabled: boolean;
      data: { targetPlayerId: number; targetZone: string; targetIndex: number; asReorderSlot: boolean };
    };
    expect(dropCall.disabled).toBe(false);
    expect(dropCall.data).toEqual({
      targetPlayerId: 7,
      targetZone: Enriched.ZoneName.HAND,
      targetIndex: 3,
      asReorderSlot: true,
    });
  });

  it('carries the slot index on the draggable data for reorder', () => {
    const card = makeCard({ id: 6 });
    renderHook(() =>
      useCardSlot({ card, draggable: true, ownerPlayerId: 1, zone: Enriched.ZoneName.HAND, dropIndex: 2 }),
    );
    const dragCall = useDraggableMock.mock.calls[0][0] as { data: { sourceIndex: number } };
    expect(dragCall.data.sourceIndex).toBe(2);
  });

  describe('dropSide indicator', () => {
    it('returns "after" when sourceIndex < dropIndex (target shifts left after removal)', () => {
      droppableState = {
        isOver: true,
        active: {
          data: {
            current: {
              sourcePlayerId: 1,
              sourceZone: Enriched.ZoneName.HAND,
              sourceIndex: 0,
            },
          },
        },
      };
      const card = makeCard({ id: 7 });
      const { result } = renderHook(() =>
        useCardSlot({ card, draggable: true, ownerPlayerId: 1, zone: Enriched.ZoneName.HAND, dropIndex: 3 }),
      );
      expect(result.current.dropSide).toBe('after');
    });

    it('returns "before" when sourceIndex > dropIndex', () => {
      droppableState = {
        isOver: true,
        active: {
          data: {
            current: {
              sourcePlayerId: 1,
              sourceZone: Enriched.ZoneName.HAND,
              sourceIndex: 4,
            },
          },
        },
      };
      const card = makeCard({ id: 8 });
      const { result } = renderHook(() =>
        useCardSlot({ card, draggable: true, ownerPlayerId: 1, zone: Enriched.ZoneName.HAND, dropIndex: 1 }),
      );
      expect(result.current.dropSide).toBe('before');
    });

    it('returns null for cross-zone drags (source zone differs from slot zone)', () => {
      droppableState = {
        isOver: true,
        active: {
          data: {
            current: {
              sourcePlayerId: 1,
              sourceZone: Enriched.ZoneName.GRAVE,
              sourceIndex: 0,
            },
          },
        },
      };
      const card = makeCard({ id: 9 });
      const { result } = renderHook(() =>
        useCardSlot({ card, draggable: true, ownerPlayerId: 1, zone: Enriched.ZoneName.HAND, dropIndex: 2 }),
      );
      expect(result.current.dropSide).toBeNull();
    });

    it('returns null when not hovered', () => {
      droppableState = { isOver: false, active: null };
      const card = makeCard({ id: 10 });
      const { result } = renderHook(() =>
        useCardSlot({ card, draggable: true, ownerPlayerId: 1, zone: Enriched.ZoneName.HAND, dropIndex: 2 }),
      );
      expect(result.current.dropSide).toBeNull();
    });
  });
});
