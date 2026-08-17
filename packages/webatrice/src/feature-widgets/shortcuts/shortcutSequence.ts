import type { ParsedSequence } from './types';

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;

export function formatEvent(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) {
    parts.push('Ctrl');
  }
  if (event.altKey) {
    parts.push('Alt');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }
  if (event.metaKey) {
    parts.push('Meta');
  }
  parts.push(event.code);
  return parts.join('+');
}

export function parseSequence(sequence: string): ParsedSequence {
  const parts = sequence.split('+');
  const code = parts[parts.length - 1] ?? '';
  const mods = new Set(parts.slice(0, -1));
  return {
    code,
    ctrl: mods.has('Ctrl'),
    alt: mods.has('Alt'),
    shift: mods.has('Shift'),
    meta: mods.has('Meta'),
  };
}

export function matchesEvent(sequence: string, event: KeyboardEvent): boolean {
  const parsed = parseSequence(sequence);
  return (
    parsed.code === event.code &&
    parsed.ctrl === event.ctrlKey &&
    parsed.alt === event.altKey &&
    parsed.shift === event.shiftKey &&
    parsed.meta === event.metaKey
  );
}

// Pure modifier presses (Ctrl, Shift alone) shouldn't trigger or get captured.
export function isModifierOnly(event: KeyboardEvent): boolean {
  return (
    event.code.startsWith('Control') ||
    event.code.startsWith('Shift') ||
    event.code.startsWith('Alt') ||
    event.code.startsWith('Meta')
  );
}

// User-facing label for a sequence: strips KeyboardEvent.code prefixes so chips read
// "Ctrl+D" instead of "Ctrl+KeyD".
const CODE_DISPLAY: Record<string, string> = {
  NumpadAdd: 'Num+',
  NumpadSubtract: 'Num-',
  NumpadMultiply: 'Num*',
  NumpadDivide: 'Num/',
  NumpadDecimal: 'Num.',
  NumpadEnter: 'Num⏎',
  Equal: '=',
  Minus: '-',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Semicolon: ';',
  Quote: '\'',
  Backquote: '`',
  BracketLeft: '[',
  BracketRight: ']',
  Space: 'Space',
  Backspace: 'Backspace',
  Enter: 'Enter',
  Escape: 'Esc',
  Tab: 'Tab',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

function displayCode(code: string): string {
  if (CODE_DISPLAY[code]) {
    return CODE_DISPLAY[code];
  }
  if (code.startsWith('Key') && code.length === 4) {
    return code.slice(3);
  }
  if (code.startsWith('Digit') && code.length === 6) {
    return code.slice(5);
  }
  if (code.startsWith('Numpad')) {
    return `Num${code.slice(6)}`;
  }
  return code;
}

export function displaySequence(sequence: string): string {
  const parts = sequence.split('+');
  const code = parts[parts.length - 1] ?? '';
  const mods = parts.slice(0, -1);
  return [...mods, displayCode(code)].join('+');
}

/** Same idea as `displaySequence`, but returns the parts as an array
 *  instead of a `+`-joined string. Split BEFORE display formatting so
 *  labels that contain a `+` (e.g. `NumpadAdd` → `Num+`) don't get
 *  chopped by a naive `split('+')` on the joined form. */
export function displaySequenceParts(sequence: string): string[] {
  const parts = sequence.split('+');
  const code = parts[parts.length - 1] ?? '';
  const mods = parts.slice(0, -1);
  return [...mods, displayCode(code)];
}

/** Mac-style symbol variant — `⌘⇧D` instead of `Ctrl+Shift+D`. Ctrl and
 *  Meta both map to ⌘ (matches Cockatrice desktop / Qt's treatment of
 *  Ctrl as the primary modifier). Non-Mac formatting stays word-joined. */
const MAC_MODIFIER: Record<string, string> = {
  Ctrl: '⌘',
  Meta: '⌘',
  Alt: '⌥',
  Shift: '⇧',
};
export function displaySequenceForOs(sequence: string, isMac: boolean): string {
  if (!isMac) {
    return displaySequence(sequence);
  }
  const parts = sequence.split('+');
  const code = parts[parts.length - 1] ?? '';
  const mods = parts.slice(0, -1).map((m) => MAC_MODIFIER[m] ?? m);
  // Mac convention: no separators between modifier symbols.
  return `${mods.join('')}${displayCode(code)}`;
}

// Stable string comparison key for de-duping a sequence list (modifier order is fixed).
export function normalizeSequence(sequence: string): string {
  const parsed = parseSequence(sequence);
  const parts: string[] = [];
  for (const mod of MODIFIER_ORDER) {
    if (mod === 'Ctrl' && parsed.ctrl) {
      parts.push(mod);
    }
    if (mod === 'Alt' && parsed.alt) {
      parts.push(mod);
    }
    if (mod === 'Shift' && parsed.shift) {
      parts.push(mod);
    }
    if (mod === 'Meta' && parsed.meta) {
      parts.push(mod);
    }
  }
  parts.push(parsed.code);
  return parts.join('+');
}
