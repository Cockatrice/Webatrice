import { useTranslation } from 'react-i18next';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';

import { usePreference, useSettings, useThemeName } from '@app/hooks';
import { ThemeMode } from '@app/types';

import type { CustomControlProps } from '../registry';
import { ThemePreview, ThemeTile } from './ThemeTile';

const THEME_LABEL_KEYS: Record<ThemeMode, string> = {
  [ThemeMode.Light]: 'SettingsAppearance.themeMode.light',
  [ThemeMode.Dark]: 'SettingsAppearance.themeMode.dark',
  [ThemeMode.System]: 'SettingsAppearance.themeMode.system',
};

const TILES: { mode: ThemeMode; icon: LucideIcon; shade: 'light' | 'dark' | 'split' }[] = [
  { mode: ThemeMode.Light, icon: Sun, shade: 'light' },
  { mode: ThemeMode.Dark, icon: Moon, shade: 'dark' },
  { mode: ThemeMode.System, icon: Monitor, shade: 'split' },
];

export default function ThemeTiles({ id, labelId, describedBy, disabled }: CustomControlProps) {
  const { t } = useTranslation();
  const settings = useSettings();
  const current = usePreference('themeMode');
  const themeName = useThemeName();

  return (
    <div role="radiogroup" aria-labelledby={labelId} aria-describedby={describedBy} className="flex flex-wrap gap-gap">
      {TILES.map(({ mode, icon, shade }) => (
        <ThemeTile
          key={mode}
          id={mode === current ? id : undefined}
          name={`${id}-theme`}
          value={mode}
          checked={current === mode}
          disabled={disabled}
          onSelect={() => void settings.update({ themeMode: mode })}
          icon={icon}
          label={t(THEME_LABEL_KEYS[mode])}
          preview={<ThemePreview themeName={themeName} shade={shade} />}
        />
      ))}
    </div>
  );
}
