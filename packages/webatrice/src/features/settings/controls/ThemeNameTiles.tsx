import { useTranslation } from 'react-i18next';

import { useSettings, useThemeName } from '@app/hooks';
import { ThemeName } from '@app/types';

import type { CustomControlProps } from '../registry';
import { ThemePreview, ThemeTile } from './ThemeTile';

const THEME_NAME_LABEL_KEYS: Record<ThemeName, string> = {
  [ThemeName.Midnight]: 'SettingsAppearance.themeName.midnight',
  [ThemeName.Graphite]: 'SettingsAppearance.themeName.graphite',
  [ThemeName.Carbon]: 'SettingsAppearance.themeName.carbon',
};

const THEME_NAMES: readonly ThemeName[] = [ThemeName.Midnight, ThemeName.Graphite, ThemeName.Carbon];

export default function ThemeNameTiles({ id, labelId, describedBy, disabled }: CustomControlProps) {
  const { t } = useTranslation();
  const settings = useSettings();
  const current = useThemeName();

  return (
    <div role="radiogroup" aria-labelledby={labelId} aria-describedby={describedBy} className="flex flex-wrap gap-gap">
      {THEME_NAMES.map((name) => (
        <ThemeTile
          key={name}
          id={name === current ? id : undefined}
          name={`${id}-theme-name`}
          value={name}
          checked={current === name}
          disabled={disabled}
          onSelect={() => void settings.update({ themeName: name })}
          label={t(THEME_NAME_LABEL_KEYS[name])}
          preview={<ThemePreview themeName={name} shade="split" />}
        />
      ))}
    </div>
  );
}
