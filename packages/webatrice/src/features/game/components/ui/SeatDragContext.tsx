import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ProviderProps,
  type ReactNode,
} from 'react';
import { useDndContext, useDndMonitor, useDraggable, useDroppable, type DragMoveEvent } from '@dnd-kit/core';

import type { Coordinates } from '../../hooks/gamePointerSensor';
import {
  isSeatDragSource,
  isSeatDropZone,
  type SeatDragCard,
  type SeatDragSource,
  type SeatDropPoint,
  type SeatDropTarget,
  type SeatDropZone,
  type SeatZone,
} from '../../hooks/seatDropPlan';

export const SEAT_DRAG_THRESHOLD_PX = 4;

const ActiveSeatDragContext = createContext<SeatDragSource | null>(null);
type SeatDragActivator = (
  event: ReactPointerEvent<HTMLElement>,
  cards: readonly SeatDragCard[],
  onRelease: ((event: PointerEvent) => void) | undefined,
  options: SeatDragSourceOptions,
) => void;
const SeatDragActivatorContext = createContext<SeatDragActivator | null>(null);

export function ActiveSeatDragProvider({ value, children }: ProviderProps<SeatDragSource | null>) {
  const data = useRef<SeatDragSource>({
    kind: 'seat',
    seatPlayerId: 0,
    zone: 'battlefield',
    cards: [],
    activationDistance: SEAT_DRAG_THRESHOLD_PX,
  }).current;
  const { setNodeRef, listeners } = useDraggable({ id: 'active-seat-drag', data });
  const activate = useCallback<SeatDragActivator>(
    (event, cards, onRelease, options) => {
      if (options.disabled || event.button !== 0 || cards.length === 0 || !listeners) {
        return;
      }
      const canDrag = !options.canMoveFor || cards.every((card) =>
        options.canMoveFor!(card.ownerPlayerId ?? options.seatPlayerId));
      Object.assign(data, {
        seatPlayerId: options.seatPlayerId,
        zone: options.zone,
        lenderPlayerId: options.lenderPlayerId,
        cards,
        onRelease,
        activationDistance: canDrag ? SEAT_DRAG_THRESHOLD_PX : Number.POSITIVE_INFINITY,
      });
      setNodeRef(event.currentTarget);
      listeners.onPointerDown(event);
      event.preventDefault();
    },
    [data, listeners, setNodeRef],
  );

  return (
    <ActiveSeatDragContext.Provider value={value}>
      <SeatDragActivatorContext.Provider value={activate}>
        {children}
      </SeatDragActivatorContext.Provider>
    </ActiveSeatDragContext.Provider>
  );
}

export function useActiveSeatDrag(): SeatDragSource | null {
  return useContext(ActiveSeatDragContext);
}

export interface SeatDragSourceOptions {
  seatPlayerId: number;
  zone: SeatZone;
  lenderPlayerId?: number;
  canMoveFor?: (ownerPlayerId: number) => boolean;
  disabled?: boolean;
}

export type SeatDragStart = (
  event: ReactPointerEvent<HTMLElement>,
  cards: readonly SeatDragCard[],
  onRelease?: (event: PointerEvent) => void,
) => void;

export function useSeatDragSource(_id: string, options: SeatDragSourceOptions): SeatDragStart {
  const activate = useContext(SeatDragActivatorContext);
  return useCallback<SeatDragStart>(
    (event, cards, onRelease) => {
      if (!activate) {
        return;
      }
      activate(event, cards, onRelease, options);
    },
    [activate, options],
  );
}

export function useSeatDropZone(
  id: string,
  zone: Omit<SeatDropZone, 'kind'>,
  disabled = false,
): (element: HTMLElement | null) => void {
  const { setNodeRef } = useDroppable({ id, data: { kind: 'seat-drop', ...zone }, disabled });
  return setNodeRef;
}

export function SeatDragGhost({ children }: { children: (origin: Coordinates) => ReactNode }) {
  const { active } = useDndContext();
  const [delta, setDelta] = useState<Coordinates>({ x: 0, y: 0 });
  useDndMonitor({
    onDragMove: (event) => setDelta(event.delta),
    onDragEnd: () => setDelta({ x: 0, y: 0 }),
    onDragCancel: () => setDelta({ x: 0, y: 0 }),
  });
  const initial = active?.rect.current.initial;
  if (!initial) {
    return null;
  }
  return <>{children({ x: initial.left + delta.x, y: initial.top + delta.y })}</>;
}

export function seatDropPointOf(event: Pick<DragMoveEvent, 'activatorEvent' | 'active' | 'delta'>): SeatDropPoint {
  const activator = event.activatorEvent as PointerEvent | null;
  const start = { x: activator?.clientX ?? 0, y: activator?.clientY ?? 0 };
  const origin = event.active.rect.current.initial ?? { left: start.x, top: start.y };
  return {
    pointer: { x: start.x + event.delta.x, y: start.y + event.delta.y },
    cardOrigin: { x: origin.left + event.delta.x, y: origin.top + event.delta.y },
  };
}

export function SeatDropPreview({
  dropId,
  children,
}: {
  dropId: string;
  children: (target: SeatDropTarget | null) => ReactNode;
}) {
  const [target, setTarget] = useState<SeatDropTarget | null>(null);
  const follow = (event: DragMoveEvent) => {
    const zone = event.over?.data.current;
    const source = event.active.data.current;
    setTarget(
      event.over?.id === dropId && isSeatDropZone(zone) && isSeatDragSource(source)
        ? zone.resolve(seatDropPointOf(event), source)
        : null,
    );
  };
  useDndMonitor({
    onDragMove: follow,
    onDragOver: follow,
    onDragEnd: () => setTarget(null),
    onDragCancel: () => setTarget(null),
  });
  return <>{children(target)}</>;
}
