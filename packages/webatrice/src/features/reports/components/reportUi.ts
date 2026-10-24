import type { ReportListLoadState } from '../hooks/useReportListLoad';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export function listStatusText(t: Translate, loadState: ReportListLoadState, count: number): string {
  if (loadState === 'loading') {
    return t('Reports.loading');
  }
  if (loadState === 'failed') {
    return t('Reports.loadFailed');
  }
  return t('Reports.count', { count });
}
