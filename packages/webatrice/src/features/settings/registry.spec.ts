import { Bell } from 'lucide-react';

import { RouteEnum } from '@app/types';

import { buildSettingsSections, preferenceKeysOf, SettingsSectionId, type SettingsSection } from './registry';
import { settingsSections } from './sections';

const Custom = () => null;

const section = (id: SettingsSectionId, groupIds: string[]): SettingsSection => ({
  id,
  titleKey: `t.${id}`,
  icon: Bell,
  groups: groupIds.map((groupId) => ({
    id: groupId,
    titleKey: `g.${groupId}`,
    entries: [{ id: groupId, labelKey: 'l', control: { kind: 'toggle', key: 'tapAnimation' } }],
  })),
});

describe('buildSettingsSections', () => {
  it('orders sections as desktop does, whatever the registration order', () => {
    const built = buildSettingsSections([
      section(SettingsSectionId.Sound, ['s']),
      section(SettingsSectionId.Appearance, ['a']),
      section(SettingsSectionId.Chat, ['c']),
    ]);
    expect(built.map((s) => s.id)).toEqual([
      SettingsSectionId.Appearance,
      SettingsSectionId.Chat,
      SettingsSectionId.Sound,
    ]);
  });

  it('merges groups registered by several modules on one section', () => {
    const built = buildSettingsSections([
      section(SettingsSectionId.Appearance, ['tableGrid']),
      section(SettingsSectionId.Appearance, ['theme', 'cards']),
    ]);
    expect(built).toHaveLength(1);
    expect(built[0].groups?.map((g) => g.id)).toEqual(['tableGrid', 'theme', 'cards']);
  });

  it('leaves out a section nothing has filled', () => {
    expect(buildSettingsSections([section(SettingsSectionId.Storage, [])])).toEqual([]);
  });

  it('refuses to merge into a custom page', () => {
    const page: SettingsSection = { id: SettingsSectionId.Shortcuts, titleKey: 't', icon: Bell, page: RouteEnum.SHORTCUTS };
    expect(() => buildSettingsSections([page, section(SettingsSectionId.Shortcuts, ['x'])])).toThrow(/custom page/);
  });
});

describe('preferenceKeysOf', () => {
  it('collects built-in keys and the keys custom controls declare, once each', () => {
    const s: SettingsSection = {
      id: SettingsSectionId.Chat,
      titleKey: 't',
      icon: Bell,
      groups: [
        {
          id: 'g',
          titleKey: 'g',
          entries: [
            { id: 'a', labelKey: 'a', control: { kind: 'toggle', key: 'chatMention' } },
            { id: 'b', labelKey: 'b', control: { kind: 'color', key: 'chatMentionColor' } },
            { id: 'c', labelKey: 'c', control: { kind: 'custom', component: Custom, keys: ['messageMacros'] } },
            { id: 'd', labelKey: 'd', control: { kind: 'custom', component: Custom } },
            { id: 'e', labelKey: 'e', control: { kind: 'toggle', key: 'chatMention' } },
          ],
        },
      ],
    };
    expect(preferenceKeysOf(s)).toEqual(['chatMention', 'chatMentionColor', 'messageMacros']);
  });
});

describe('registered sections', () => {
  it('give every entry a unique id', () => {
    const ids = settingsSections.flatMap((s) => s.groups ?? []).flatMap((g) => g.entries.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('list the pages in desktop order', () => {
    expect(settingsSections.map((s) => s.id)).toEqual([
      SettingsSectionId.General,
      SettingsSectionId.Appearance,
      SettingsSectionId.UserInterface,
      SettingsSectionId.CardSources,
      SettingsSectionId.Storage,
      SettingsSectionId.Chat,
      SettingsSectionId.Sound,
      SettingsSectionId.Shortcuts,
    ]);
  });
});
