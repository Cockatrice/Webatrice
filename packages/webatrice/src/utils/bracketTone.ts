export interface BracketTone {
  text: string;
  bg: string;
  border: string;
}

export const BRACKET_TONE: Record<number, BracketTone> = {
  1: { text: 'text-success', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' },
  2: { text: 'text-success', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' },
  3: { text: 'text-warning', bg: 'bg-yellow-500/15', border: 'border-yellow-500/40' },
  4: { text: 'text-danger', bg: 'bg-red-500/15', border: 'border-red-500/40' },
  5: { text: 'text-danger', bg: 'bg-red-500/15', border: 'border-red-500/40' },
};

const NEUTRAL_TONE_CLASS = 'text-text-secondary bg-bg-elevated border-border-subtle';

export function bracketToneClass(level: number): string {
  const tone = BRACKET_TONE[level];
  return tone ? `${tone.text} ${tone.bg} ${tone.border}` : NEUTRAL_TONE_CLASS;
}
