import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ANIMATION_PREFERENCE_KEYS,
  chooseAnimations,
  resolveAnimation,
  usePreferences,
  usePrefersReducedMotion,
  useSettings,
  type AnimationPreferenceKey,
} from '@app/hooks';

import { Button } from '@app/components';

import type { CustomControlProps } from '../registry';
import { Switch } from './fields';

function useChooseAnimations() {
  const settings = useSettings();
  const preferences = usePreferences();
  const reducedMotion = usePrefersReducedMotion();
  return {
    preferences,
    reducedMotion,
    choose: (changes: Partial<Record<AnimationPreferenceKey, boolean>>) => {
      void settings.update(chooseAnimations(preferences, reducedMotion, changes));
    },
  };
}

export function animationToggle(key: AnimationPreferenceKey): ComponentType<CustomControlProps> {
  function AnimationToggle({ id, labelId, describedBy, disabled }: CustomControlProps) {
    const { preferences, reducedMotion, choose } = useChooseAnimations();
    return (
      <Switch
        id={id}
        checked={resolveAnimation(preferences, key, reducedMotion)}
        disabled={disabled}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        onChange={(checked) => choose({ [key]: checked })}
      />
    );
  }
  AnimationToggle.displayName = `AnimationToggle(${key})`;
  return AnimationToggle;
}

export function AnimationButtons({ labelId, disabled }: CustomControlProps) {
  const { t } = useTranslation();
  const { choose } = useChooseAnimations();
  const setAll = (enabled: boolean) => choose(Object.fromEntries(ANIMATION_PREFERENCE_KEYS.map((key) => [key, enabled])));

  return (
    <span className="inline-flex flex-wrap gap-2" role="group" aria-labelledby={labelId}>
      <Button size="sm" disabled={disabled} onClick={() => setAll(true)}>
        {t('SettingsUserInterface.animations.enableAll')}
      </Button>
      <Button size="sm" disabled={disabled} onClick={() => setAll(false)}>
        {t('SettingsUserInterface.animations.disableAll')}
      </Button>
    </span>
  );
}
