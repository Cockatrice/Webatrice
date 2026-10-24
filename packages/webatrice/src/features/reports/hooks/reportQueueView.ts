import { ReportStatus, type ReportStatusCounts } from '@cockatrice/datatrice';

export const REPORT_QUEUE_VIEWS = ['unresolved', 'open', 'assigned', 'resolved', 'dismissed', 'all'] as const;

export type ReportQueueView = typeof REPORT_QUEUE_VIEWS[number];

export interface ReportQueueQuery {
  unresolvedOnly: boolean;
  status: '' | ReportStatus;
}

export function reportQueueQuery(view: ReportQueueView): ReportQueueQuery {
  switch (view) {
    case 'unresolved':
      return { unresolvedOnly: true, status: '' };
    case 'open':
      return { unresolvedOnly: true, status: ReportStatus.OPEN };
    case 'assigned':
      return { unresolvedOnly: true, status: ReportStatus.ASSIGNED };
    case 'resolved':
      return { unresolvedOnly: false, status: ReportStatus.RESOLVED };
    case 'dismissed':
      return { unresolvedOnly: false, status: ReportStatus.DISMISSED };
    case 'all':
      return { unresolvedOnly: false, status: '' };
  }
}

export function reportQueueViewCounts(
  view: ReportQueueView,
  counts: ReportStatusCounts,
): Record<ReportQueueView, number | null> {
  const loadedAll = !reportQueueQuery(view).unresolvedOnly;
  const unresolved = counts.open + counts.assigned;
  return {
    unresolved,
    open: counts.open,
    assigned: counts.assigned,
    resolved: loadedAll ? counts.resolved : null,
    dismissed: loadedAll ? counts.dismissed : null,
    all: loadedAll ? unresolved + counts.resolved + counts.dismissed : null,
  };
}
