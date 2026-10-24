import { DndContext, useDroppable } from '@dnd-kit/core';
import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';

import { isSeatDragSource, type SeatDragSource } from '../../hooks/seatDropPlan';
import { ActiveSeatDragProvider, useSeatDragSource } from './SeatDragContext';

function DragSource({ onRender }: { onRender: () => void }) {
  onRender();
  const start = useSeatDragSource('seat-1-hand', { seatPlayerId: 1, zone: 'hand' });
  return (
    <button onPointerDown={(event) => start(event, [{ id: 'card-1' }])}>
      Card
    </button>
  );
}

function DropTargets() {
  const first = useDroppable({ id: 'first' });
  const second = useDroppable({ id: 'second' });
  return (
    <>
      <div data-drop-target="first" ref={first.setNodeRef} />
      <div data-drop-target="second" ref={second.setNodeRef} />
    </>
  );
}

function Harness({
  onRender,
  onDragMove,
  onDragEnd,
}: {
  onRender: () => void;
  onDragMove: () => void;
  onDragEnd: () => void;
}) {
  const [activeDrag, setActiveDrag] = useState<SeatDragSource | null>(null);
  return (
    <DndContext
      onDragStart={(event) => {
        const source = event.active.data.current;
        if (isSeatDragSource(source)) {
          setActiveDrag({ ...source });
        }
      }}
      onDragMove={onDragMove}
      onDragEnd={() => {
        onDragEnd();
        setActiveDrag(null);
      }}
    >
      <ActiveSeatDragProvider value={activeDrag}>
        <DragSource onRender={onRender} />
        <DropTargets />
      </ActiveSeatDragProvider>
    </DndContext>
  );
}

describe('SeatDragContext', () => {
  it('keeps pointer-move updates inside the drag layer instead of re-rendering the source seat', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getTestRect() {
      const target = this.dataset.dropTarget;
      const left = target === 'first' ? 100 : target === 'second' ? 200 : 0;
      return new DOMRect(left, 0, 50, 50);
    });
    const onRender = vi.fn();
    const onDragMove = vi.fn();
    const onDragEnd = vi.fn();
    const { getByRole } = render(
      <Harness onRender={onRender} onDragMove={onDragMove} onDragEnd={onDragEnd} />,
    );

    fireEvent.pointerDown(getByRole('button', { name: 'Card' }), {
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 10,
      isPrimary: true,
      pointerId: 1,
    });
    const rendersAfterActivation = onRender.mock.calls.length;

    fireEvent.pointerMove(document, { buttons: 1, clientX: 110, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(document, { buttons: 1, clientX: 210, clientY: 10, pointerId: 1 });

    expect(onDragMove).toHaveBeenCalledTimes(2);
    expect(onRender).toHaveBeenCalledTimes(rendersAfterActivation);

    fireEvent.pointerUp(document, { button: 0, clientX: 210, clientY: 10, pointerId: 1 });
    expect(onDragEnd).toHaveBeenCalledOnce();
  });
});
