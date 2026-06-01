import type { BoxSelectPreview } from '../../../hooks/useGameBoxSelection';

import './BoxSelectOverlay.css';

export interface BoxSelectOverlayProps {
  preview: BoxSelectPreview | null;
}

// Rubber-band rectangle. Positioned against the viewport (position: fixed) so a
// drag started inside a position:fixed zone dialog still paints in the right
// place and above the dialog.
function BoxSelectOverlay({ preview }: BoxSelectOverlayProps) {
  if (!preview) {
    return null;
  }
  return (
    <div
      className="box-select-overlay"
      data-testid="box-select-overlay"
      style={{
        left: preview.left,
        top: preview.top,
        width: preview.width,
        height: preview.height,
      }}
    />
  );
}

export default BoxSelectOverlay;
