import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';

import { Button } from '@app/components';
import { usePreferences } from '@app/hooks';
import { soundEngine } from '@app/services';

import type { CustomControlProps } from '../registry';

export default function SoundTestButton({ id, labelId, disabled }: CustomControlProps) {
  const { t } = useTranslation();
  const { soundEnabled, soundTheme, masterVolume } = usePreferences();

  return (
    <Button
      id={id}
      aria-labelledby={labelId}
      disabled={disabled || !soundEnabled}
      onClick={() => soundEngine.test({ enabled: soundEnabled, theme: soundTheme, volume: masterVolume })}
      icon={<Play size={14} aria-hidden />}
    >
      {t('SettingsSound.test.button')}
    </Button>
  );
}
