import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';

import { Button, type ButtonSize } from '@app/components';
import { ConfirmDialog } from '@app/dialogs';
import { LoadingState, useSettings } from '@app/hooks';

import { defaultsPatch, preferenceKeysOfAll, type SettingsSection } from './registry';

interface RestoreDefaultsButtonProps {
  sections: readonly SettingsSection[];
  label: string;
  title: string;
  message: string;
  size?: ButtonSize;
  className?: string;
}

export default function RestoreDefaultsButton({ sections, label, title, message, size = 'md', className }: RestoreDefaultsButtonProps) {
  const { t } = useTranslation();
  const settings = useSettings();
  const [confirming, setConfirming] = useState(false);
  const keys = preferenceKeysOfAll(sections);

  if (keys.length === 0) {
    return null;
  }

  const restore = () => {
    void settings.update(defaultsPatch(keys));
    setConfirming(false);
  };

  return (
    <>
      <Button
        variant="quiet"
        size={size}
        className={className}
        icon={<RotateCcw size={size === 'sm' ? 12 : 14} aria-hidden />}
        disabled={settings.status !== LoadingState.READY}
        onClick={() => setConfirming(true)}
      >
        {label}
      </Button>
      <ConfirmDialog
        isOpen={confirming}
        title={title}
        message={message}
        confirmLabel={t('Settings.restoreDefaults')}
        cancelLabel={t('Settings.restoreDefaultsConfirm.cancel')}
        destructive
        onConfirm={restore}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
