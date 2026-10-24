import { act, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { rooms, type Message } from '@cockatrice/datatrice';
import { Event_RoomSaySchema } from '@cockatrice/sockatrice/generated';

import { connectedWithRoomsState, renderWithProviders } from '../../../__test-utils__';
import { useAppSelector } from '../../../store';
import RoomChat from './RoomChat';
import RoomUsers from './RoomUsers';
import * as people from './useRoomPeople';
import * as chat from './roomChatContext';

const onSay = vi.fn();

function RoomLists() {
  const room = useAppSelector((state) => rooms.Selectors.getRoom(state, 1));
  const messages = useAppSelector((state) => rooms.Selectors.getRoomMessages(state, 1));
  return <>
    <RoomUsers roomId={1} roomName={room.info.name} />
    <RoomChat roomId={1} roomName={room.info.name} users={room.users} messages={messages} onSay={onSay} />
  </>;
}

it('renders just the new chat row and no room user list on an incoming message', () => {
  const messages: Message[] = Array.from({ length: 320 }, (_, id) => ({
    ...create(Event_RoomSaySchema, { name: 'alice', message: `line ${id}` }), id: id + 1000, timeReceived: id,
  }));
  const { store } = renderWithProviders(<RoomLists />, { preloadedState: {
    ...connectedWithRoomsState,
    rooms: { ...connectedWithRoomsState.rooms!, messages: { 1: messages } },
  } });
  const format = vi.spyOn(chat, 'chatLineTime');
  const users = vi.spyOn(people, 'useRoomPeople');
  act(() => {
    store.dispatch(rooms.Actions.roomSayReceived({
      roomId: 1,
      message: { ...create(Event_RoomSaySchema, { name: 'alice', message: 'incoming' }), timeReceived: 400 },
    }));
  });
  expect(screen.getByRole('log')).toHaveTextContent('incoming');
  expect(format).toHaveBeenCalledTimes(1);
  expect(users).not.toHaveBeenCalled();
});
