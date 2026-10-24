import { useTranslation } from 'react-i18next';

import type { Response_ReportUserInfo } from '@cockatrice/sockatrice/generated';
import { sectionLabelClass } from '@app/feature-wrappers/staff';
import { cx } from '@app/utils';

import { formatEpoch } from './moderationFormat';

interface UserInfoPanelProps {
  userName: string;
  info: Response_ReportUserInfo | undefined;
  loading: boolean;
  error: string | null;
}

function CountTile({ label, value, tone }: { label: string; value: number | undefined; tone: 'warning' | 'danger' }) {
  const active = (value ?? 0) > 0;
  return (
    <div className="flex flex-1 flex-col rounded-ui border border-border-subtle bg-bg-base/50 px-2.5 py-1.5">
      <span
        className={cx(
          'font-display text-[20px] font-semibold leading-tight tabular-nums',
          active ? (tone === 'danger' ? 'text-danger' : 'text-warning') : 'text-text-primary',
        )}
      >
        {value ?? '-'}
      </span>
      <span className="text-[11px] text-text-muted">{label}</span>
    </div>
  );
}

const UserInfoPanel = ({ userName, info, loading, error }: UserInfoPanelProps) => {
  const { t } = useTranslation();
  const pendingText = loading ? t('ModerationPage.value.loading') : '';

  let status = '';
  if (error) {
    status = error;
  } else if (info) {
    status = [
      info.isActive ? t('ModerationPage.info.active') : t('ModerationPage.info.inactive'),
      ...(info.isAdmin ? [t('ModerationPage.info.admin')] : []),
    ].join(', ');
  }

  const fields: [string, string][] = [
    [t('ModerationPage.info.registered'), info ? formatEpoch(info.registrationTime, t) : pendingText],
    [t('ModerationPage.info.lastLogin'), info ? formatEpoch(info.lastLogin, t) : pendingText],
    [t('ModerationPage.info.status'), status],
  ];

  return (
    <section aria-label={t('ModerationPage.info.title')} className="flex flex-col gap-3">
      {!userName ? (
        <p className="text-[13px] text-text-muted">{t('ModerationPage.info.hint')}</p>
      ) : (
        <>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            {fields.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-text-muted">{label}</dt>
                <dd className="text-text-primary">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex gap-2">
            <CountTile label={t('ModerationPage.info.reports')} value={info?.totalReports} tone="warning" />
            <CountTile label={t('ModerationPage.info.warnings')} value={info?.totalWarns} tone="warning" />
            <CountTile label={t('ModerationPage.info.bans')} value={info?.totalBans} tone="danger" />
          </div>
          <div className="flex flex-col gap-1">
            <span className={sectionLabelClass}>{t('ModerationPage.info.adminNotes')}</span>
            <p
              className={cx(
                'whitespace-pre-wrap break-words rounded-ui border border-border-subtle bg-bg-base/50 px-2.5 py-2',
                'text-[12px] text-text-primary',
              )}
            >
              {info ? (info.adminNotes || t('ModerationPage.info.noNotes')) : pendingText}
            </p>
          </div>
        </>
      )}
    </section>
  );
};

export default UserInfoPanel;
