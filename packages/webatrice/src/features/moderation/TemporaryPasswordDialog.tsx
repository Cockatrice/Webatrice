import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@app/components';
import { DialogShell } from '@app/dialogs';
import { fieldClass, labelClass } from '@app/feature-wrappers/staff';

import type { TemporaryPassword } from './useModeration';

interface TemporaryPasswordDialogProps {
  result: TemporaryPassword | null;
  onDismiss: () => void;
}

const TemporaryPasswordDialog = ({ result, onDismiss }: TemporaryPasswordDialogProps) => {
  const { t } = useTranslation();
  const inputId = useId();

  return (
    <DialogShell
      isOpen={result !== null}
      handleClose={onDismiss}
      title={t('ModerationPage.password.title')}
      footer={<Button variant="primary" onClick={onDismiss} autoFocus>{t('ModerationPage.button.ok')}</Button>}
    >
      <div className="flex flex-col gap-3">
        <p>{t('ModerationPage.password.for', { userName: result?.userName ?? '' })}</p>
        <label htmlFor={inputId} className={labelClass}>{t('ModerationPage.password.label')}</label>
        <input id={inputId} className={`${fieldClass} -mt-2 font-mono`} value={result?.temporaryPassword ?? ''} readOnly />
        <p>{t('ModerationPage.password.secureChannel')}</p>
      </div>
    </DialogShell>
  );
};

export default TemporaryPasswordDialog;
