import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

import { cx } from '@app/utils';

import { PANE_KEY_STEP, PANE_KEY_STEP_LARGE, type PaneRange } from '../../deckEditorLayout';

export interface PaneResizerProps {
  label: string;
  hint?: string;
  side: 'left' | 'right';
  width: number;
  range: PaneRange;
  onResize: (width: number) => void;
  onResizeBy: (delta: number) => void;
  onReset: () => void;
  onCollapse: () => void;
  style?: CSSProperties;
}

export function PaneResizer({ label, hint, side, width, range, onResize, onResizeBy, onReset, onCollapse, style }: PaneResizerProps) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const direction = side === 'left' ? 1 : -1;

  useEffect(() => {
    if (!dragging) {
      return;
    }
    const { cursor, userSelect } = document.body.style;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = cursor;
      document.body.style.userSelect = userSelect;
    };
  }, [dragging]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.focus();
    drag.current = { startX: event.clientX, startWidth: width };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      onResize(drag.current.startWidth + direction * (event.clientX - drag.current.startX));
    }
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) {
      return;
    }
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? PANE_KEY_STEP_LARGE : PANE_KEY_STEP;
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    if (event.key === 'ArrowRight') {
      onResizeBy(direction * step);
    } else if (event.key === 'ArrowLeft') {
      onResizeBy(-direction * step);
    } else if (event.key === 'Home') {
      onResize(range.min);
    } else if (event.key === 'End') {
      onResize(range.max);
    } else if (event.key === 'Enter') {
      onCollapse();
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={range.min}
      aria-valuemax={range.max}
      tabIndex={0}
      title={hint ? `${label}. ${hint}` : label}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className={cx(
        'group absolute inset-y-0 z-10 flex w-2 -translate-x-1/2 cursor-col-resize touch-none select-none justify-center',
        'focus:outline-none',
      )}
    >
      <span
        aria-hidden
        className={cx(
          'h-full w-px transition-colors',
          dragging
            ? 'w-0.5 bg-accent'
            : 'bg-transparent group-hover:w-0.5 group-hover:bg-accent/70 group-focus-visible:w-0.5 group-focus-visible:bg-accent',
        )}
      />
    </div>
  );
}
