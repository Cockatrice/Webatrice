import { allActionIds, defaults, type ActionId, type ShortcutGroupId } from '@app/feature-widgets/shortcuts';
import type { Preferences } from '@app/types';

import type { SettingEntry, SettingsGroup, SettingsSection } from './registry';

type Translate = (key: string) => string;

export interface FilteredGroup {
  group: SettingsGroup;
  entries: SettingEntry[];
}

export interface FilteredSection {
  section: SettingsSection;
  groups: FilteredGroup[];
  count: number;
  titleMatch: boolean;
}

export interface ShortcutHit {
  actionId: ActionId;
  groupId: ShortcutGroupId;
  sequences: readonly string[];
}

export interface SettingsSearchResult {
  sections: FilteredSection[];
  shortcuts: ShortcutHit[];
  settingCount: number;
}

export type ShortcutOverrides = Partial<Record<ActionId, string[]>>;

export function matchesQuery(query: string, ...texts: readonly string[]): boolean {
  const q = query.trim().toLowerCase();
  return q === '' || texts.some((text) => text.toLowerCase().includes(q));
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

export function highlightParts(text: string, rawQuery: string): HighlightPart[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return [{ text, match: false }];
  }
  const parts: HighlightPart[] = [];
  const lower = text.toLowerCase();
  let from = 0;
  for (let at = lower.indexOf(query); at >= 0; at = lower.indexOf(query, from)) {
    if (at > from) {
      parts.push({ text: text.slice(from, at), match: false });
    }
    parts.push({ text: text.slice(at, at + query.length), match: true });
    from = at + query.length;
  }
  if (from < text.length) {
    parts.push({ text: text.slice(from), match: false });
  }
  return parts;
}

const isShown = (entry: SettingEntry, preferences?: Preferences) =>
  !preferences || !entry.visibleWhen || entry.visibleWhen(preferences);

export function filterSections(
  sections: readonly SettingsSection[],
  query: string,
  t: Translate,
  preferences?: Preferences,
): FilteredSection[] {
  return sections.map((section) => {
    const sectionTitle = t(section.titleKey);
    const groups = (section.groups ?? []).flatMap((group) => {
      const groupTitle = t(group.titleKey);
      const entries = group.entries.filter((entry) => isShown(entry, preferences) && matchesQuery(
        query,
        t(entry.labelKey),
        entry.descriptionKey ? t(entry.descriptionKey) : '',
        groupTitle,
        sectionTitle,
      ));
      return entries.length > 0 ? [{ group, entries }] : [];
    });
    return {
      section,
      groups,
      count: groups.reduce((sum, { entries }) => sum + entries.length, 0),
      titleMatch: query.trim() !== '' && matchesQuery(query, sectionTitle),
    };
  });
}

export function searchShortcuts(query: string, t: Translate, overrides: ShortcutOverrides = {}): ShortcutHit[] {
  if (!query.trim()) {
    return [];
  }
  return allActionIds
    .filter((id) => matchesQuery(query, t(`ShortcutsTab.action.${id}`), t(`ShortcutsTab.group.${defaults[id].group}`)))
    .map((id) => ({ actionId: id, groupId: defaults[id].group, sequences: overrides[id] ?? defaults[id].sequences }));
}

export function searchSettings(
  sections: readonly SettingsSection[],
  query: string,
  t: Translate,
  options: { preferences?: Preferences; overrides?: ShortcutOverrides } = {},
): SettingsSearchResult {
  const filtered = filterSections(sections, query, t, options.preferences);
  return {
    sections: filtered,
    shortcuts: searchShortcuts(query, t, options.overrides),
    settingCount: filtered.reduce((sum, { count }) => sum + count, 0),
  };
}

export const shortcutCount = allActionIds.length;
