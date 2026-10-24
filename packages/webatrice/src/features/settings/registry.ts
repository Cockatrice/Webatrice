import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

import {
  PREFERENCE_DEFAULTS,
  type BooleanPreferenceKey,
  type NumberPreferenceKey,
  type PreferenceKey,
  type Preferences,
  type RouteEnum,
  type StringPreferenceKey,
} from '@app/types';

export enum SettingsSectionId {
  General = 'general',
  Appearance = 'appearance',
  UserInterface = 'userInterface',
  CardSources = 'cardSources',
  Storage = 'storage',
  Chat = 'chat',
  Sound = 'sound',
  Shortcuts = 'shortcuts',
}

export const SECTION_ORDER: readonly SettingsSectionId[] = [
  SettingsSectionId.General,
  SettingsSectionId.Appearance,
  SettingsSectionId.UserInterface,
  SettingsSectionId.CardSources,
  SettingsSectionId.Storage,
  SettingsSectionId.Chat,
  SettingsSectionId.Sound,
  SettingsSectionId.Shortcuts,
];

export interface SelectOption {
  value: string;
  labelKey?: string;
  label?: string;
}

export type SettingControl =
  | { kind: 'toggle'; key: BooleanPreferenceKey }
  | { kind: 'select'; key: StringPreferenceKey; options: readonly SelectOption[] }
  | {
    kind: 'range';
    key: NumberPreferenceKey;
    min: number;
    max: number;
    step?: number;
    onCommit?: (preferences: Preferences) => void;
  }
  | { kind: 'text'; key: StringPreferenceKey; placeholderKey?: string }
  | {
    kind: 'number';
    key: NumberPreferenceKey;
    min: number;
    max: number;
    unitKey?: string;
    pushes?: { key: NumberPreferenceKey; keep: 'atLeast' | 'atMost' };
  }
  | { kind: 'color'; key: StringPreferenceKey }
  | {
    kind: 'custom';
    component: ComponentType<CustomControlProps>;
    keys?: readonly PreferenceKey[];
    layout?: 'inline' | 'block';
  };

export interface CustomControlProps {
  id: string;
  labelId: string;
  describedBy?: string;
  disabled: boolean;
}

export interface SettingEntry {
  id: string;
  labelKey: string;
  descriptionKey?: string;
  control: SettingControl;
  dependsOn?: BooleanPreferenceKey;
  visibleWhen?: (preferences: Preferences) => boolean;
}

export interface SettingsGroup {
  id: string;
  titleKey: string;
  entries: readonly SettingEntry[];
}

export interface SettingsSection {
  id: SettingsSectionId;
  titleKey: string;
  icon: LucideIcon;
  groups?: readonly SettingsGroup[];
  page?: RouteEnum;
}

export function preferenceKeysOf(section: SettingsSection): PreferenceKey[] {
  const keys = new Set<PreferenceKey>();
  for (const group of section.groups ?? []) {
    for (const { control } of group.entries) {
      if (control.kind === 'custom') {
        control.keys?.forEach((key) => keys.add(key));
      } else {
        keys.add(control.key);
      }
    }
  }
  return [...keys];
}

export function preferenceKeysOfAll(sections: readonly SettingsSection[]): PreferenceKey[] {
  return [...new Set(sections.flatMap(preferenceKeysOf))];
}

export function defaultsPatch(keys: readonly PreferenceKey[]): Partial<Preferences> {
  return Object.fromEntries(keys.map((key) => [key, structuredClone(PREFERENCE_DEFAULTS[key])])) as Partial<Preferences>;
}

export function buildSettingsSections(registrations: readonly SettingsSection[]): SettingsSection[] {
  const byId = new Map<SettingsSectionId, SettingsSection>();
  for (const registration of registrations) {
    const existing = byId.get(registration.id);
    if (!existing) {
      byId.set(registration.id, { ...registration });
      continue;
    }
    if (existing.page || registration.page) {
      throw new Error(`Settings section "${registration.id}" is a custom page and cannot be shared`);
    }
    existing.groups = [...(existing.groups ?? []), ...(registration.groups ?? [])];
  }
  return SECTION_ORDER.flatMap((id) => {
    const section = byId.get(id);
    return section && (section.page || section.groups?.length) ? [section] : [];
  });
}
