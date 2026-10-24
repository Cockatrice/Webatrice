import { useTranslation } from 'react-i18next';

import type { ServerInfo_User } from '@cockatrice/sockatrice/generated';
import { formatAccountAge, formatUserLevel } from '@app/utils';

interface BasicUserInfoPanelProps {
  userName: string;
  info: ServerInfo_User | undefined;
  loading: boolean;
  error: string | null;
}

const BasicUserInfoPanel = ({ userName, info, loading, error }: BasicUserInfoPanelProps) => {
  const { t, i18n } = useTranslation();

  if (!userName) {
    return <p className="text-[13px] text-text-muted">{t('ModerationPage.basic.hint')}</p>;
  }

  const blank = loading ? t('ModerationPage.value.loading') : (error ?? '-');
  const value = (text: string | undefined) => (info ? text || '-' : blank);
  const fields: [string, string][] = [
    [t('ModerationPage.basic.role'), info ? formatUserLevel(t, info.userLevel, info.privlevel) : blank],
    [t('ModerationPage.basic.accountAge'), info ? formatAccountAge(t, info.accountageSecs, info.userLevel, i18n.language) : blank],
    [t('ModerationPage.basic.realName'), value(info?.realName)],
    [t('ModerationPage.basic.country'), value(info?.country.toUpperCase())],
    [t('ModerationPage.basic.clientId'), value(info?.clientid)],
    [t('ModerationPage.basic.address'), value(info?.address)],
  ];

  return (
    <section aria-label={t('ModerationPage.info.title')} className="flex flex-col gap-3">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        {fields.map(([label, text]) => (
          <div key={label} className="contents">
            <dt className="text-text-muted">{label}</dt>
            <dd className="break-all text-text-primary">{text}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] leading-snug text-text-muted">{t('ModerationPage.basic.countsNote')}</p>
    </section>
  );
};

export default BasicUserInfoPanel;
