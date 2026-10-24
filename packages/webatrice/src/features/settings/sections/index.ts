import { buildSettingsSections, type SettingsSection } from '../registry';
import { appearanceSection } from './appearance';
import { cardSourcesSection } from './cardSources';
import { chatSection } from './chat';
import { generalSection } from './general';
import { playmatsSection } from './playmats';
import { shortcutsSection } from './shortcuts';
import { soundSection } from './sound';
import { storageSection } from './storage';
import { themeSection } from './theme';
import { userInterfaceSection } from './userInterface';

const registrations: readonly SettingsSection[] = [
  generalSection,
  themeSection,
  playmatsSection,
  appearanceSection,
  userInterfaceSection,
  cardSourcesSection,
  storageSection,
  chatSection,
  soundSection,
  shortcutsSection,
];

export const settingsSections: readonly SettingsSection[] = buildSettingsSections(registrations);
