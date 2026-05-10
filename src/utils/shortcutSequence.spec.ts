import {
  displaySequence,
  formatEvent,
  isModifierOnly,
  matchesEvent,
  normalizeSequence,
  parseSequence,
} from './shortcutSequence';

function evt(init: Partial<KeyboardEventInit> & { code: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('formatEvent', () => {
  it('emits modifier+code with stable order Ctrl+Alt+Shift+Meta', () => {
    expect(formatEvent(evt({ code: 'KeyA', ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+KeyA');
  });

  it('emits bare code when no modifiers held', () => {
    expect(formatEvent(evt({ code: 'F5' }))).toBe('F5');
  });

  it('orders all four modifiers consistently', () => {
    expect(
      formatEvent(evt({ code: 'KeyZ', ctrlKey: true, altKey: true, shiftKey: true, metaKey: true })),
    ).toBe('Ctrl+Alt+Shift+Meta+KeyZ');
  });
});

describe('parseSequence', () => {
  it('parses a single key', () => {
    expect(parseSequence('F5')).toEqual({ code: 'F5', ctrl: false, alt: false, shift: false, meta: false });
  });

  it('parses modifiers + code', () => {
    expect(parseSequence('Ctrl+Shift+KeyA')).toEqual({
      code: 'KeyA',
      ctrl: true,
      alt: false,
      shift: true,
      meta: false,
    });
  });
});

describe('matchesEvent', () => {
  it('matches when code and modifier flags align', () => {
    expect(matchesEvent('Ctrl+KeyD', evt({ code: 'KeyD', ctrlKey: true }))).toBe(true);
  });

  it('rejects on extra modifier', () => {
    expect(matchesEvent('Ctrl+KeyD', evt({ code: 'KeyD', ctrlKey: true, shiftKey: true }))).toBe(false);
  });

  it('rejects on missing modifier', () => {
    expect(matchesEvent('Ctrl+KeyD', evt({ code: 'KeyD' }))).toBe(false);
  });

  it('rejects on different code', () => {
    expect(matchesEvent('F5', evt({ code: 'F6' }))).toBe(false);
  });
});

describe('isModifierOnly', () => {
  it('is true for ControlLeft, ShiftRight, AltLeft, MetaLeft', () => {
    expect(isModifierOnly(evt({ code: 'ControlLeft' }))).toBe(true);
    expect(isModifierOnly(evt({ code: 'ShiftRight' }))).toBe(true);
    expect(isModifierOnly(evt({ code: 'AltLeft' }))).toBe(true);
    expect(isModifierOnly(evt({ code: 'MetaLeft' }))).toBe(true);
  });

  it('is false for letter keys', () => {
    expect(isModifierOnly(evt({ code: 'KeyA', ctrlKey: true }))).toBe(false);
  });
});

describe('normalizeSequence', () => {
  it('reorders modifiers into canonical order', () => {
    expect(normalizeSequence('Shift+Ctrl+KeyA')).toBe('Ctrl+Shift+KeyA');
  });

  it('is idempotent for already-canonical input', () => {
    expect(normalizeSequence('Ctrl+Alt+Shift+Meta+KeyZ')).toBe('Ctrl+Alt+Shift+Meta+KeyZ');
  });
});

describe('displaySequence', () => {
  it('strips Key prefix from letter codes', () => {
    expect(displaySequence('Ctrl+KeyD')).toBe('Ctrl+D');
  });

  it('strips Digit prefix from number codes', () => {
    expect(displaySequence('Ctrl+Digit1')).toBe('Ctrl+1');
  });

  it('renders symbol codes as their character', () => {
    expect(displaySequence('Equal')).toBe('=');
    expect(displaySequence('Minus')).toBe('-');
  });

  it('renames Numpad codes with Num prefix', () => {
    expect(displaySequence('NumpadAdd')).toBe('Num+');
    expect(displaySequence('Numpad5')).toBe('Num5');
  });

  it('preserves function keys verbatim', () => {
    expect(displaySequence('F5')).toBe('F5');
  });

  it('renders Escape as Esc', () => {
    expect(displaySequence('Escape')).toBe('Esc');
  });
});
