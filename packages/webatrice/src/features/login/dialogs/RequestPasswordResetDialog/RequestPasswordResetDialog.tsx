import { useTranslation } from 'react-i18next';

import { DialogShell } from '@app/dialogs';

import RequestPasswordResetForm, { RequestPasswordResetFormValues } from '../../forms/RequestPasswordResetForm/RequestPasswordResetForm';

interface RequestPasswordResetDialogProps {
  isOpen: boolean;
  handleClose?: () => void;
  onSubmit: (values: RequestPasswordResetFormValues) => void;
  skipTokenRequest: (userName: string) => void;
}

const RequestPasswordResetDialog = ({
  handleClose,
  isOpen,
  onSubmit,
  skipTokenRequest,
}: RequestPasswordResetDialogProps) => {
  const { t } = useTranslation();

  return (
    <DialogShell
      isOpen={isOpen}
      handleClose={handleClose}
      title={t('RequestPasswordResetDialog.title')}
    >
      <RequestPasswordResetForm onSubmit={onSubmit} skipTokenRequest={skipTokenRequest} />
    </DialogShell>
  );
};

export default RequestPasswordResetDialog;
