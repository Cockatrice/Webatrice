import { useTranslation } from 'react-i18next';

import { DialogShell } from '@app/dialogs';
import type { HostDTO } from '@app/services';

import KnownHostForm, { type KnownHostFormValues } from './KnownHostForm';

interface KnownHostDialogProps {
  isOpen: boolean;
  handleClose?: () => void;
  onRemove: (host: HostDTO) => void;
  onSubmit: (values: KnownHostFormValues) => void;
  host?: HostDTO;
}

const KnownHostDialog = ({ handleClose, onRemove, onSubmit, isOpen, host }: KnownHostDialogProps) => {
  const { t } = useTranslation();
  const mode = host ? 'edit' : 'add';

  return (
    <DialogShell
      isOpen={isOpen}
      handleClose={handleClose}
      title={t('KnownHostDialog.title', { mode })}
    >
      <p className="text-sm text-text-muted mb-4">{t('KnownHostDialog.subtitle')}</p>
      <KnownHostForm onRemove={onRemove} onSubmit={onSubmit} host={host} />
    </DialogShell>
  );
};

export default KnownHostDialog;
