import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

import { DialogShell } from '@app/dialogs';

import AccountActivationForm, { AccountActivationFormValues } from '../../forms/AccountActivationForm/AccountActivationForm';

import './AccountActivationDialog.css';

interface AccountActivationDialogProps {
  isOpen: boolean;
  handleClose?: () => void;
  onSubmit: (values: AccountActivationFormValues) => void;
}

const AccountActivationDialog = ({ handleClose, isOpen, onSubmit }: AccountActivationDialogProps) => {
  const { t } = useTranslation();

  return (
    <DialogShell
      isOpen={isOpen}
      handleClose={handleClose}
      title={t('AccountActivationDialog.title')}
    >
      <div className="content">
        <Typography variant='subtitle1'>{ t('AccountActivationDialog.subtitle1') }</Typography>
        <Typography variant='subtitle1'>{ t('AccountActivationDialog.subtitle2') }</Typography>
      </div>

      <AccountActivationForm onSubmit={onSubmit} />
    </DialogShell>
  );
};

export default AccountActivationDialog;
