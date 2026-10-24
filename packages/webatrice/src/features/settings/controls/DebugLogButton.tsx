import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollText } from 'lucide-react';

import { Button } from '@app/components';
import { DebugLogDialog } from '@app/dialogs';

import type { CustomControlProps } from '../registry';

export default function DebugLogButton({ id, labelId, describedBy, disabled }: CustomControlProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        id={id}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => setOpen(true)}
        icon={<ScrollText size={14} aria-hidden />}
      >
        {t('SettingsGeneral.debugLog.button')}
      </Button>
      <DebugLogDialog isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
