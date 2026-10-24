import {
  initialNotificationState,
  notificationReducer,
  type NotificationInput,
  type NotificationState,
} from '../../services/notifications/notificationStore';
import { filterCounts, groupEntries } from './notificationFilters';

const mention: NotificationInput = { kind: 'mention', actor: 'bob', place: 'Magic', target: { type: 'room', roomId: 3 } };
const message: NotificationInput = { kind: 'message', actor: 'bob', body: 'hi', target: { type: 'chat', userName: 'bob' } };

const apply = (...actions: Parameters<typeof notificationReducer>[1][]) =>
  actions.reduce<NotificationState>(notificationReducer, initialNotificationState);

describe('notification filters', () => {
  it('counts per kind and splits the shown entries into new and earlier', () => {
    const state = apply(
      { type: 'append', entry: mention, time: 1, read: true },
      { type: 'append', entry: message, time: 1, read: false },
      { type: 'append', entry: message, time: 1, read: true },
    );
    expect(filterCounts(state.entries)).toMatchObject({ all: 3, message: 2, mention: 1, game: 0 });
    const { fresh, earlier } = groupEntries(state.entries, 'message');
    expect([fresh.length, earlier.length]).toEqual([1, 1]);
  });
});
