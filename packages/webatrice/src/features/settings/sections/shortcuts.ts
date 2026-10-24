import { Keyboard } from 'lucide-react';

import { RouteEnum } from '@app/types';

import { SettingsSectionId, type SettingsSection } from '../registry';

export const shortcutsSection: SettingsSection = {
  id: SettingsSectionId.Shortcuts,
  titleKey: 'Settings.section.shortcuts',
  icon: Keyboard,
  page: RouteEnum.SHORTCUTS,
};
