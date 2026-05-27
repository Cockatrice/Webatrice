import { AuthGuard, ModGuard } from '@app/components';

import LogResults from './LogResults';
import LogSearchForm from './LogSearchForm/LogSearchForm';
import { useLogs } from './useLogs';

import './Logs.css';

const Logs = () => {
  const { logs, onSubmit } = useLogs();

  return (
    <div className="moderator-logs scrollable">
      <AuthGuard />
      <ModGuard />

      <div className="moderator-logs__form">
        <LogSearchForm onSubmit={onSubmit} />
      </div>

      <div className="moderator-logs__results">
        <LogResults logs={logs} />
      </div>
    </div>
  );
};

export default Logs;
