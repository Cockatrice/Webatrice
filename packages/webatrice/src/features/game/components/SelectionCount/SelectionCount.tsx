import type { CSSProperties } from 'react';
import { usePreference } from '@app/hooks';

const LABEL_CLASS =
  'pointer-events-none select-none font-mono font-bold text-over-art-text bg-over-art-backdrop/60 rounded-[3px] px-0.5 py-px';

const LABEL_PADDING_PX = 4;
const labelWidth = (count: number) => String(count).length * 9 + 4;
const LABEL_HEIGHT_PX = 20;

export interface MarqueeRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function dragCountPlacement(band: MarqueeRect, count: number): Pick<CSSProperties, 'left' | 'right' | 'top' | 'bottom'> | null {
  const width = Math.abs(band.x2 - band.x1);
  const height = Math.abs(band.y2 - band.y1);
  if (width < labelWidth(count) + 2 * LABEL_PADDING_PX || height < LABEL_HEIGHT_PX + 2 * LABEL_PADDING_PX) {
    return null;
  }
  return {
    ...(band.x2 >= band.x1 ? { right: LABEL_PADDING_PX } : { left: LABEL_PADDING_PX }),
    ...(band.y2 >= band.y1 ? { bottom: LABEL_PADDING_PX } : { top: LABEL_PADDING_PX }),
  };
}

export function DragSelectionCount({ band, count }: { band: MarqueeRect; count: number }) {
  const enabled = usePreference('showDragSelectionCount');
  const placement = enabled && count > 0 ? dragCountPlacement(band, count) : null;
  if (!placement) {
    return null;
  }
  return (
    <span data-testid="drag-selection-count" className={`absolute text-[14px] ${LABEL_CLASS}`} style={placement}>
      {count}
    </span>
  );
}
