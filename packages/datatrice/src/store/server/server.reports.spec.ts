import { countReportStatuses, filterReports, isReportOpen, ReportStatus } from './server.reports';
import { makeReport } from '../../testing/fixtures/server';

describe('isReportOpen', () => {
  it.each([
    [ReportStatus.OPEN, true],
    [ReportStatus.ASSIGNED, true],
    [ReportStatus.RESOLVED, false],
    [ReportStatus.DISMISSED, false],
    ['', false],
  ])('%s -> %s', (status, expected) => {
    expect(isReportOpen(status)).toBe(expected);
  });
});

describe('filterReports', () => {
  const rows = [
    makeReport({ reportId: 1, reporterName: 'Alice', reportedUserName: 'Mallory', category: 'spam', status: 'open' }),
    makeReport({ reportId: 2, reporterName: 'Bob', reportedUserName: 'Eve', category: 'cheating', status: 'resolved' }),
    makeReport({ reportId: 3, reporterName: 'Carol', reportedUserName: 'Trent', description: 'Said SPAM links', status: 'open' }),
  ];

  it('returns the same array when no filter is set', () => {
    expect(filterReports(rows, '', '')).toBe(rows);
  });

  it('matches reporter, reported user, category and description case-insensitively', () => {
    expect(filterReports(rows, 'mallory', '').map(r => r.reportId)).toEqual([1]);
    expect(filterReports(rows, 'BOB', '').map(r => r.reportId)).toEqual([2]);
    expect(filterReports(rows, 'spam', '').map(r => r.reportId)).toEqual([1, 3]);
  });

  it('matches the status exactly and combines with the search', () => {
    expect(filterReports(rows, '', 'open').map(r => r.reportId)).toEqual([1, 3]);
    expect(filterReports(rows, 'spam', 'resolved')).toEqual([]);
  });
});

describe('countReportStatuses', () => {
  it('tallies the four known statuses and ignores unknown ones', () => {
    const rows = ['open', 'open', 'assigned', 'resolved', 'dismissed', 'weird'].map((status, i) =>
      makeReport({ reportId: i, status }));
    expect(countReportStatuses(rows)).toEqual({ open: 2, assigned: 1, resolved: 1, dismissed: 1 });
  });
});
