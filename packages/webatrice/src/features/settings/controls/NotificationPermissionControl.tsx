import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';

import { Button } from '@app/components';
import { getNotificationPermission, requestNotificationPermission, watchNotificationPermission } from '@app/services';

import type { CustomControlProps } from '../registry';

export default function NotificationPermissionControl({ id, labelId, describedBy }: CustomControlProps) {
  const { t } = useTranslation();
  const [permission, setPermission] = useState(getNotificationPermission);

  useEffect(() => watchNotificationPermission(setPermission), []);

  const request = async () => {
    setPermission(await requestNotificationPermission());
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-3" role="group" aria-labelledby={labelId} aria-describedby={describedBy}>
      <span
        className={permission === 'denied' ? 'text-[12px] text-danger' : 'text-[12px] text-text-muted'}
        data-permission={permission}
        aria-live="polite"
      >
        {t(`SettingsUserInterface.browserNotifications.status.${permission}`)}
      </span>
      {permission === 'default' && (
        <Button id={id} onClick={request} icon={<Bell size={14} aria-hidden />}>
          {t('SettingsUserInterface.browserNotifications.request')}
        </Button>
      )}
    </span>
  );
}
