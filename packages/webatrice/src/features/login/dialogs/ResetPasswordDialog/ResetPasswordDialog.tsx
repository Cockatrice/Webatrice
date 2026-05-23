import { useTranslation } from 'react-i18next';

import { DialogShell } from '@app/dialogs';

import ResetPasswordForm, { ResetPasswordFormValues } from '../../forms/ResetPasswordForm/ResetPasswordForm';

interface ResetPasswordDialogProps {
  isOpen: boolean;
  handleClose?: () => void;
  onSubmit: (values: ResetPasswordFormValues) => void;
  userName?: string;
}

const ResetPasswordDialog = ({ handleClose, isOpen, onSubmit, userName }: ResetPasswordDialogProps) => {
  const { t } = useTranslation();

  return (
    <DialogShell
      isOpen={isOpen}
      handleClose={handleClose}
      title={t('ResetPasswordDialog.title')}
    >
      <ResetPasswordForm onSubmit={onSubmit} userName={userName} />
    </DialogShell>
  );
};

export default ResetPasswordDialog;
