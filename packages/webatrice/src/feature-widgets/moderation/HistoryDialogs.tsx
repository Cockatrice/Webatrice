import { useTranslation } from 'react-i18next';

import type { ServerInfo_Ban, ServerInfo_Warning } from '@cockatrice/sockatrice/generated';
import { DialogShell } from '@app/dialogs';

import { BUTTON_PRIMARY_CLASS, TABLE_CLASS, TD_CLASS, TH_CLASS } from './moderationStyles';

interface HistoryTableProps {
  title: string;
  userName: string;
  headers: string[];
  rows: string[][];
  onClose: () => void;
}

const HistoryTable = ({ title, userName, headers, rows, onClose }: HistoryTableProps) => {
  const { t } = useTranslation();
  return (
    <DialogShell isOpen handleClose={onClose} title={title} maxWidth="max-w-3xl">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-text-muted">{userName}</p>
        <div className="overflow-auto max-h-[60vh] border border-border-subtle rounded-md">
          <table className={TABLE_CLASS}>
            <thead className="bg-bg-elevated sticky top-0">
              <tr>
                {headers.map((header) => <th key={header} className={TH_CLASS}>{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, i) => (
                <tr key={i} className="border-t border-border-subtle">
                  {cells.map((cell, j) => <td key={j} className={TD_CLASS}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <button type="button" className={BUTTON_PRIMARY_CLASS} onClick={onClose}>{t('Moderation.common.close')}</button>
        </div>
      </div>
    </DialogShell>
  );
};

export interface BanHistoryDialogProps {
  userName: string;
  bans: ServerInfo_Ban[];
  onClose: () => void;
}

export const BanHistoryDialog = ({ userName, bans, onClose }: BanHistoryDialogProps) => {
  const { t } = useTranslation();
  return (
    <HistoryTable
      title={t('Moderation.banHistory.title')}
      userName={userName}
      headers={[
        t('Moderation.banHistory.banTime'),
        t('Moderation.banHistory.moderator'),
        t('Moderation.banHistory.banLength'),
        t('Moderation.banHistory.banReason'),
        t('Moderation.banHistory.visibleReason'),
      ]}
      rows={bans.map((ban) => [ban.banTime, ban.adminName, ban.banLength, ban.banReason, ban.visibleReason])}
      onClose={onClose}
    />
  );
};

export interface WarnHistoryDialogProps {
  userName: string;
  warnings: ServerInfo_Warning[];
  onClose: () => void;
}

export const WarnHistoryDialog = ({ userName, warnings, onClose }: WarnHistoryDialogProps) => {
  const { t } = useTranslation();
  return (
    <HistoryTable
      title={t('Moderation.warnHistory.title')}
      userName={userName}
      headers={[
        t('Moderation.warnHistory.warningTime'),
        t('Moderation.warnHistory.moderator'),
        t('Moderation.warnHistory.userName'),
        t('Moderation.warnHistory.reason'),
      ]}
      rows={warnings.map((warning) => [warning.timeOf, warning.adminName, warning.userName, warning.reason])}
      onClose={onClose}
    />
  );
};
