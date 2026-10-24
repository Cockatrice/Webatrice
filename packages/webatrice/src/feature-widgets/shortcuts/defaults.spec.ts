import { BROWSER_RESERVED_SEQUENCES } from './browserReserved';
import { allActionIds, defaults } from './defaults';
import i18n from './SettingsTab/ShortcutsTab.i18n.json';
import { normalizeSequence } from './shortcutSequence';
import { ShortcutScope, type ActionId } from './types';

type Bindings = Readonly<Record<string, { scope: ShortcutScope; sequences: readonly string[] }>>;

function duplicateBindings(table: Bindings): [string, string[]][] {
  const owners = new Map<string, string[]>();
  for (const [id, { scope, sequences }] of Object.entries(table)) {
    for (const sequence of sequences) {
      const key = `${scope} ${normalizeSequence(sequence)}`;
      owners.set(key, [...(owners.get(key) ?? []), id]);
    }
  }
  return [...owners].filter(([, ids]) => ids.length > 1);
}

function reservedOwners(table: Bindings, sequence: string): string[] {
  const reserved = normalizeSequence(sequence);
  return Object.keys(table).filter((id) => table[id].sequences.some((s) => normalizeSequence(s) === reserved));
}

describe('the default checks themselves', () => {
  it('catch a duplicate that differs only in modifier order', () => {
    expect(duplicateBindings({
      a: { scope: ShortcutScope.GAME, sequences: ['Ctrl+Shift+KeyK'] },
      b: { scope: ShortcutScope.GAME, sequences: ['Shift+Ctrl+KeyK'] },
      c: { scope: ShortcutScope.ROOM, sequences: ['Ctrl+Shift+KeyK'] },
    })).toEqual([[`${ShortcutScope.GAME} ${normalizeSequence('Ctrl+Shift+KeyK')}`, ['a', 'b']]]);
  });

  it('catch a reserved chord bound outside the game scope', () => {
    const table: Bindings = { 'deck.save': { scope: ShortcutScope.DECK_EDITOR, sequences: ['Shift+F5', 'Ctrl+Digit5'] } };
    expect(reservedOwners(table, 'Ctrl+Digit5')).toEqual(['deck.save']);
    expect(reservedOwners(table, 'F5')).toEqual([]);
  });

  it('reserve every tab, window, reload, fullscreen and devtools chord', () => {
    const digits = Array.from({ length: 10 }, (_, d) => `Ctrl+Digit${d}`);
    expect([...BROWSER_RESERVED_SEQUENCES].sort()).toEqual([
      'F5', 'F11', 'F12', 'Alt+F4',
      'Ctrl+KeyT', 'Ctrl+Shift+KeyT', 'Ctrl+KeyW', 'Ctrl+Shift+KeyW', 'Ctrl+KeyN', 'Ctrl+Shift+KeyN',
      'Ctrl+Tab', 'Ctrl+Shift+Tab', 'Ctrl+PageUp', 'Ctrl+PageDown',
      ...digits,
    ].sort());
  });
});

describe('shortcut defaults', () => {
  const boundTo = (sequence: string) =>
    (Object.keys(defaults) as ActionId[]).filter((id) => defaults[id].sequences.includes(sequence));

  it('binds Shift+Tab to next phase with action only', () => {
    expect(boundTo('Shift+Tab')).toEqual(['game.nextPhaseAction']);
  });

  it('leaves previous phase unbound', () => {
    expect(defaults['game.prevPhase'].sequences).toEqual([]);
  });

  it('binds no sequence to two actions of one scope', () => {
    expect(duplicateBindings(defaults)).toEqual([]);
  });

  it('labels every action and group in the Shortcuts tab', () => {
    const labels: Record<string, string> = i18n.ShortcutsTab.action;
    const groups: Record<string, string> = i18n.ShortcutsTab.group;
    expect(allActionIds.filter((id) => !labels[id])).toEqual([]);
    expect([...new Set(allActionIds.map((id) => defaults[id].group))].filter((g) => !groups[g])).toEqual([]);
  });

  it.each(BROWSER_RESERVED_SEQUENCES)('binds no action to the browser-reserved %s', (sequence) => {
    expect(reservedOwners(defaults, sequence)).toEqual([]);
  });
});
