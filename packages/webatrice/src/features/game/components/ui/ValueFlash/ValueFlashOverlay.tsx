import type { ValueFlash } from './useValueFlash';

import './ValueFlash.css';

export default function ValueFlashOverlay({ flash, kind }: { flash: ValueFlash | null; kind: 'change' | 'damage' }) {
  if (!flash || (kind === 'damage' && flash.direction !== 'loss')) {
    return null;
  }
  const modifier = kind === 'damage' ? 'damage' : flash.direction;
  return <span key={flash.key} aria-hidden data-testid={`value-flash-${modifier}`} className={`value-flash value-flash--${modifier}`} />;
}
