import { Fragment, type ReactNode } from 'react';

import { displaySequenceParts } from '../shortcutSequence';

/** Renders a single key cap. Splits nothing — takes the label text and
 *  gives it the raised-keycap look. */
function Key({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warning' }) {
  const base = [
    'inline-flex items-center justify-center',
    'min-w-[24px] h-6 px-2',
    'text-[11px] font-mono font-semibold leading-none',
    'rounded-md border',
    // White-keyboard styling: light face, darker bottom edge for the
    // pressable bevel, subtle white highlight on top for depth.
    'border-b-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_0_rgba(0,0,0,0.15)]',
  ];
  const palette =
    tone === 'warning'
      ? ['bg-amber-50', 'text-amber-900', 'border-amber-400', 'border-b-amber-600']
      : ['bg-neutral-50', 'text-neutral-900', 'border-neutral-400', 'border-b-neutral-500'];
  return <span className={[...base, ...palette].join(' ')}>{children}</span>;
}

interface KeycapSequenceProps {
  /** Raw sequence string (e.g. `Ctrl+Alt+KeyU`, `Shift+Enter`). */
  sequence: string;
  tone?: 'neutral' | 'warning';
}

/** Renders a sequence like `Ctrl+Alt+U` as separate keycaps joined by a
 *  small `+`. Uses `displaySequence` to strip `Key` / `Digit` prefixes
 *  before splitting. */
export function KeycapSequence({ sequence, tone }: KeycapSequenceProps) {
  const parts = displaySequenceParts(sequence);
  return (
    <span className="inline-flex items-center gap-0.5">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-text-muted text-sm font-semibold">+</span>}
          <Key tone={tone}>{part}</Key>
        </Fragment>
      ))}
    </span>
  );
}
