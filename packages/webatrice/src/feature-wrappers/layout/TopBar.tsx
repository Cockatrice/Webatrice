import { useTranslation } from 'react-i18next';

import { NotificationBell } from '@app/feature-widgets/notifications';

import TabList from './TabList';
import { useConnectionState } from './hooks/useConnectionState';
import { useSessionTabs } from './hooks/useSessionTabs';
import { focusRailToggle } from './railToggle';

export default function TopBar() {
  const { t } = useTranslation();
  const connectionState = useConnectionState();
  const { groups, activeKey, close, unreadOf } = useSessionTabs();

  return (
    <header className="relative z-40 flex h-11 shrink-0 items-center gap-2 border-b border-border-subtle bg-bg-surface pl-2 pr-2">
      <span role="status" className="sr-only">{t(`TopBar.connection.${connectionState}`)}</span>
      <TabList
        groups={groups}
        activeKey={activeKey}
        onClose={close}
        unreadOf={unreadOf}
        onLastClosed={focusRailToggle}
      />
      <NotificationBell />
    </header>
  );
}
