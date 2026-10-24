import { Bell } from 'lucide-react';

import { PREFERENCE_DEFAULTS, RouteEnum, StartupTab } from '@app/types';

import { SettingsSectionId, type SettingsSection } from './registry';
import { filterSections, highlightParts, matchesQuery, searchSettings, searchShortcuts } from './searchSettings';

const strings: Record<string, string> = {
  'page.sound': 'Sound',
  'page.shortcuts': 'Shortcuts',
  'group.sound': 'Sound settings',
  'group.misc': 'Miscellaneous',
  'label.enable': 'Enable sounds',
  'label.volume': 'Master volume',
  'label.theme': 'Current theme',
  'label.room': 'Startup room',
  'desc.theme': 'Which sound pack plays',
  'ShortcutsTab.action.game.drawCard': 'Draw a card',
  'ShortcutsTab.action.deck.save': 'Save deck',
  'ShortcutsTab.group.gameDrawing': 'Drawing',
};
const t = (key: string) => strings[key] ?? key;

const sections: SettingsSection[] = [
  {
    id: SettingsSectionId.Sound,
    titleKey: 'page.sound',
    icon: Bell,
    groups: [
      {
        id: 'sound',
        titleKey: 'group.sound',
        entries: [
          { id: 'enable', labelKey: 'label.enable', control: { kind: 'toggle', key: 'soundEnabled' } },
          { id: 'volume', labelKey: 'label.volume', control: { kind: 'range', key: 'masterVolume', min: 0, max: 100 } },
        ],
      },
      {
        id: 'misc',
        titleKey: 'group.misc',
        entries: [
          {
            id: 'theme',
            labelKey: 'label.theme',
            descriptionKey: 'desc.theme',
            control: { kind: 'select', key: 'soundTheme', options: [] },
          },
          {
            id: 'room',
            labelKey: 'label.room',
            control: { kind: 'text', key: 'startupRoom' },
            visibleWhen: ({ startupTab }) => startupTab === StartupTab.ServerRoom,
          },
        ],
      },
    ],
  },
  { id: SettingsSectionId.Shortcuts, titleKey: 'page.shortcuts', icon: Bell, page: RouteEnum.SHORTCUTS },
];

const ids = (result: ReturnType<typeof filterSections>) =>
  result.map(({ section, groups }) => [section.id, groups.map(({ group, entries }) => [group.id, entries.map((e) => e.id)])]);

describe('matchesQuery', () => {
  it('matches any of the texts, ignoring case and outer spaces, and everything for an empty query', () => {
    expect(matchesQuery(' VOL ', 'Master volume')).toBe(true);
    expect(matchesQuery('pack', 'Current theme', 'Which sound pack plays')).toBe(true);
    expect(matchesQuery('zzz', 'Master volume')).toBe(false);
    expect(matchesQuery('  ', 'anything')).toBe(true);
  });
});

describe('highlightParts', () => {
  it('splits every match out of the text, keeping the original case', () => {
    expect(highlightParts('Card card CARD', 'card')).toEqual([
      { text: 'Card', match: true },
      { text: ' ', match: false },
      { text: 'card', match: true },
      { text: ' ', match: false },
      { text: 'CARD', match: true },
    ]);
    expect(highlightParts('Master volume', ' vol')).toEqual([
      { text: 'Master ', match: false },
      { text: 'vol', match: true },
      { text: 'ume', match: false },
    ]);
    expect(highlightParts('Master volume', '')).toEqual([{ text: 'Master volume', match: false }]);
  });
});

describe('filterSections', () => {
  it('keeps every section, group and row in place for an empty query', () => {
    expect(ids(filterSections(sections, '', t))).toEqual([
      ['sound', [['sound', ['enable', 'volume']], ['misc', ['theme', 'room']]]],
      ['shortcuts', []],
    ]);
  });

  it('filters rows in place by label, description, group title or section title', () => {
    expect(ids(filterSections(sections, 'volume', t))[0]).toEqual(['sound', [['sound', ['volume']]]]);
    expect(ids(filterSections(sections, 'pack', t))[0]).toEqual(['sound', [['misc', ['theme']]]]);
    expect(ids(filterSections(sections, 'miscell', t))[0]).toEqual(['sound', [['misc', ['theme', 'room']]]]);
    expect(filterSections(sections, 'sound', t)[0].count).toBe(4);
  });

  it('marks a section whose own title matches, so a page section such as Shortcuts stays findable', () => {
    const result = filterSections(sections, 'shortcut', t);
    expect(result.map((s) => [s.section.id, s.titleMatch])).toEqual([['sound', false], ['shortcuts', true]]);
    expect(filterSections(sections, '', t).every((s) => !s.titleMatch)).toBe(true);
  });

  it('leaves out rows hidden by their condition when the preferences are given', () => {
    const preferences = { ...PREFERENCE_DEFAULTS, startupTab: StartupTab.Replays };
    expect(filterSections(sections, '', t, preferences)[0].count).toBe(3);
    expect(filterSections(sections, 'room', t, preferences)[0].count).toBe(0);
    expect(filterSections(sections, '', t, { ...preferences, startupTab: StartupTab.ServerRoom })[0].count).toBe(4);
  });
});

describe('searchShortcuts', () => {
  it('finds shortcuts by action or group name with their current keys', () => {
    const hits = searchShortcuts('draw a', t, { 'game.drawCard': ['Ctrl+KeyZ'] });
    expect(hits).toEqual([{ actionId: 'game.drawCard', groupId: 'gameDrawing', sequences: ['Ctrl+KeyZ'] }]);
    expect(searchShortcuts('drawing', t).map((hit) => hit.actionId)).toContain('game.drawCard');
    expect(searchShortcuts('save deck', t)[0]).toMatchObject({ actionId: 'deck.save' });
  });

  it('returns nothing for an empty query', () => {
    expect(searchShortcuts(' ', t)).toEqual([]);
  });
});

describe('searchSettings', () => {
  it('merges the setting rows and the shortcuts and counts the matching settings', () => {
    const result = searchSettings(sections, 'volume', t);
    expect(result.settingCount).toBe(1);
    expect(result.shortcuts).toEqual([]);

    const draw = searchSettings(sections, 'draw a', t);
    expect(draw.settingCount).toBe(0);
    expect(draw.shortcuts.map((hit) => hit.actionId)).toEqual(['game.drawCard']);
  });
});
