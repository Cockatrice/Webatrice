import { useCallback } from 'react';

import { shortcuts, useAppSelector } from '@app/store';

import { defaults } from './defaults';
import { displaySequenceForOs, isMacPlatform, parseSequence } from './shortcutSequence';
import { ActionId } from './types';

export interface MenuShortcut {
  shortcut: string;
  keyShortcuts: string;
}

const ARIA_KEY: Record<string, string> = {
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
  NumpadAdd: 'Plus',
  NumpadSubtract: '-',
  NumpadMultiply: '*',
  NumpadDivide: '/',
  NumpadDecimal: '.',
  NumpadEnter: 'Enter',
};

function ariaKey(code: string): string {
  if (ARIA_KEY[code]) {
    return ARIA_KEY[code];
  }
  if (/^(Key|Digit)[A-Z0-9]$/.test(code)) {
    return code.slice(-1);
  }
  if (/^Numpad\d$/.test(code)) {
    return code.slice(-1);
  }
  return code;
}

function ariaSequence(sequence: string): string {
  const { code, ctrl, alt, shift, meta } = parseSequence(sequence);
  return [ctrl && 'Control', alt && 'Alt', shift && 'Shift', meta && 'Meta', ariaKey(code)]
    .filter(Boolean)
    .join('+');
}

export function toMenuShortcut(sequences: readonly string[], isMac: boolean): MenuShortcut {
  return {
    shortcut: sequences.length > 0 ? displaySequenceForOs(sequences[0], isMac) : '',
    keyShortcuts: sequences.flatMap((sequence) => {
      const { ctrl, meta } = parseSequence(sequence);
      const alternatives = isMac && ctrl && !meta
        ? [sequence, sequence.replace('Ctrl+', 'Meta+')]
        : [sequence];
      return alternatives.map(ariaSequence);
    }).join(' '),
  };
}

export function useMenuShortcut(): (actionId: ActionId) => MenuShortcut {
  const overrides = useAppSelector(shortcuts.Selectors.getOverrides);
  return useCallback(
    (actionId) => toMenuShortcut(overrides[actionId] ?? defaults[actionId]?.sequences ?? [], isMacPlatform()),
    [overrides],
  );
}
