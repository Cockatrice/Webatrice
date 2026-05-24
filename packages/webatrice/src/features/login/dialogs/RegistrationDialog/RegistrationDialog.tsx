import { useTranslation } from 'react-i18next';

import { DialogShell } from '@app/dialogs';

import RegisterForm, { RegisterFormValues } from '../../forms/RegisterForm/RegisterForm';

import './RegistrationDialog.css';

interface RegistrationDialogProps {
  isOpen: boolean;
  handleClose?: () => void;
  onSubmit: (values: RegisterFormValues) => void;
}

const RegistrationDialog = ({ handleClose, isOpen, onSubmit }: RegistrationDialogProps) => {
  const { t } = useTranslation();

  return (
    <DialogShell
      className="RegistrationDialog"
      contentClassName="dialog-content"
      isOpen={isOpen}
      handleClose={handleClose}
      title={t('RegistrationDialog.title')}
      maxWidth="xl"
    >
      <RegisterForm onSubmit={onSubmit} />
    </DialogShell>
  );
};

export default RegistrationDialog;
