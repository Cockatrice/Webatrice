import { useEffect, useRef } from 'react';

import { server } from '@cockatrice/datatrice';
import { Event_NotifyUser_NotificationType } from '@cockatrice/sockatrice/generated';
import { useNotify } from '@app/components';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';

export default function ReportNotifier() {
  const notify = useNotify();
  const lastNotice = useAppSelector(server.Selectors.getLastReportNotice);
  const isModerator = useAppSelector(server.Selectors.getIsUserModerator);

  const seen = useRef(lastNotice);

  useEffect(() => {
    if (!lastNotice || lastNotice === seen.current) {
      return;
    }
    seen.current = lastNotice;
    const { notification } = lastNotice;
    const title = notification.customTitle.replace(/\s+/g, ' ').trim();
    const content = notification.customContent.trim();
    if (!title || !content) {
      return;
    }
    const path = isModerator && notification.type === Event_NotifyUser_NotificationType.REPORT_COMMENT
      ? RouteEnum.REPORT_QUEUE
      : RouteEnum.MY_REPORTS;
    notify({
      entry: { kind: 'report', title, body: content, target: { type: 'route', path } },
      system: false,
      toast: true,
    });
  }, [lastNotice, isModerator, notify]);

  return null;
}
