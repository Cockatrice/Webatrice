import { useCallback, useEffect, useRef, useState } from 'react';

import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { RequestId } from '@cockatrice/sockatrice/types';
import type { ServerInfo_Report } from '@cockatrice/sockatrice/generated';
import { useAppSelector } from '@app/store';

import { useReportListLoad, type ReportListLoadState } from './useReportListLoad';
import { useReportThread, type ReportThread } from './useReportThread';

const MY_LIST_FAILURE = {
  type: server.Types.SESSION_COMMAND_FAILED, command: 'reportMyList', successType: server.Actions.reportMyList.type,
};

export interface MyReports {
  reports: ServerInfo_Report[];
  loadState: ReportListLoadState;
  refresh: () => void;
  selectedId: number | null;
  selected: ServerInfo_Report | undefined;
  select: (reportId: number | null) => void;
  thread: ReportThread;
}

export function useMyReports(): MyReports {
  const webClient = useWebClient();
  const reports = useAppSelector(server.Selectors.getMyReports);
  const lastNotice = useAppSelector(server.Selectors.getLastReportNotice);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = useAppSelector((state) =>
    (selectedId != null ? server.Selectors.getReport(state, selectedId) : undefined));

  const send = useCallback((requestId: RequestId) => webClient.request.session.reportMyList(requestId), [webClient]);
  const { loadState, refresh: refreshList } = useReportListLoad(send, MY_LIST_FAILURE);

  const thread = useReportThread(selectedId, () => refresh());
  const { reloadDetails } = thread;

  const refresh = useCallback(() => {
    refreshList();
    reloadDetails();
  }, [refreshList, reloadDetails]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const seenNotice = useRef(lastNotice);
  useEffect(() => {
    if (lastNotice && lastNotice !== seenNotice.current) {
      seenNotice.current = lastNotice;
      refresh();
    }
  }, [lastNotice, refresh]);

  return {
    reports,
    loadState,
    refresh,
    selectedId: selected ? selectedId : null,
    selected,
    select: setSelectedId,
    thread,
  };
}
