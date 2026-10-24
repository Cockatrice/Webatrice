import { useTranslation } from 'react-i18next';

import { AlertDialog } from '@app/dialogs';
import { StaffConsole, StaffHeader, StaffToolGuard } from '@app/feature-wrappers/staff';

import LogResults from './LogResults';
import LogSearchForm from './LogSearchForm/LogSearchForm';
import { useLogs } from './useLogs';

const LogsContent = () => {
  const { t } = useTranslation();
  const { developer, logs, notice, dismissNotice, onSubmit } = useLogs();

  return (
    <>
      <StaffHeader title={t('Logs.pageTitle')} subtitle={t('Logs.subtitle')} />
      <LogSearchForm onSubmit={onSubmit} developer={developer} />
      <LogResults logs={logs} />
      <AlertDialog
        isOpen={notice !== null}
        title={notice?.title ?? ''}
        message={notice?.message ?? ''}
        severity={notice?.severity}
        onDismiss={dismissNotice}
      />
    </>
  );
};

const Logs = () => (
  <StaffConsole>
    <StaffToolGuard tool="logs">
      <LogsContent />
    </StaffToolGuard>
  </StaffConsole>
);

export default Logs;
