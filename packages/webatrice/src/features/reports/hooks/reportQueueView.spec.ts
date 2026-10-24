import { reportQueueQuery, reportQueueViewCounts, REPORT_QUEUE_VIEWS } from './reportQueueView';

describe('reportQueueQuery', () => {
  it('asks the server for unresolved reports only on the unresolved views', () => {
    expect(REPORT_QUEUE_VIEWS.map((view) => [view, reportQueueQuery(view)])).toEqual([
      ['unresolved', { unresolvedOnly: true, status: '' }],
      ['open', { unresolvedOnly: true, status: 'open' }],
      ['assigned', { unresolvedOnly: true, status: 'assigned' }],
      ['resolved', { unresolvedOnly: false, status: 'resolved' }],
      ['dismissed', { unresolvedOnly: false, status: 'dismissed' }],
      ['all', { unresolvedOnly: false, status: '' }],
    ]);
  });
});

describe('reportQueueViewCounts', () => {
  const counts = { open: 3, assigned: 2, resolved: 41, dismissed: 4 };

  it('hides closed counts while only unresolved reports are loaded', () => {
    expect(reportQueueViewCounts('open', counts)).toEqual({
      unresolved: 5, open: 3, assigned: 2, resolved: null, dismissed: null, all: null,
    });
  });

  it('counts every status once the whole queue is loaded', () => {
    expect(reportQueueViewCounts('resolved', counts)).toEqual({
      unresolved: 5, open: 3, assigned: 2, resolved: 41, dismissed: 4, all: 50,
    });
  });
});
