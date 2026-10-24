import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { rooms as roomsSlice, type JoinRoomError, type Room } from '@cockatrice/datatrice';
import { Response_ResponseCode } from '@cockatrice/sockatrice/generated';
import { Button, Chip, Panel } from '@app/components';
import { AlertDialog } from '@app/dialogs';
import { useCommandFailureMessage } from '@app/hooks';
import { useAppDispatch, useAppSelector } from '@app/store';
import { getRoomPermissionDisplay } from '@app/utils';

const JOIN_ERROR_KEYS: Partial<Record<Response_ResponseCode, string>> = {
  [Response_ResponseCode.RespNameNotFound]: 'RoomsList.joinError.notFound',
  [Response_ResponseCode.RespContextError]: 'RoomsList.joinError.contextError',
  [Response_ResponseCode.RespUserLevelTooLow]: 'RoomsList.joinError.userLevelTooLow',
};

function joinErrorMessage(error: JoinRoomError, t: (key: string, params?: Record<string, unknown>) => string): string {
  const key = JOIN_ERROR_KEYS[error.responseCode as Response_ResponseCode];
  return key ? t(key) : t('RoomsList.joinError.unknown', { code: error.responseCode });
}

interface RoomsListProps {
  rooms: Room[];
  joinedRoomIds: Readonly<Record<number, boolean>>;
  onOpen: (roomId: number) => void;
}

export default function RoomsList({ rooms, joinedRoomIds, onOpen }: RoomsListProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const joinError = useAppSelector(roomsSlice.Selectors.getJoinRoomError);
  const describeFailure = useCommandFailureMessage();

  return (
    <Panel title={t('RoomsList.title')} count={t('RoomsList.count', { count: rooms.length })} flush className="shrink-0">
      {rooms.length === 0 ? (
        <p className="px-pad py-4 text-[13px] text-text-muted">{t('RoomsList.empty')}</p>
      ) : (
        <ul className="flex flex-col">
          {rooms.map((room) => {
            const { description, gameCount, name, playerCount, roomId } = room.info;
            const joined = Boolean(joinedRoomIds[roomId]);
            const permission = getRoomPermissionDisplay(room.info);
            return (
              <li key={roomId} className="flex items-center gap-3 border-b border-border-subtle/60 px-pad py-2 last:border-b-0">
                <span className="flex min-w-0 flex-1 flex-col" title={description || undefined}>
                  <span className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold text-text-primary">
                    <span className="truncate">{name}</span>
                    {permission !== 'none' && (
                      <Lock
                        size={12}
                        className="shrink-0 text-text-muted"
                        role="img"
                        aria-label={t('RoomsList.restricted', { level: permission })}
                      />
                    )}
                    {joined && <Chip tone="accent">{t('RoomsList.joined')}</Chip>}
                  </span>
                  <span className="text-[11.5px] tabular-nums text-text-muted">
                    {t('RoomsList.summary', { games: gameCount, people: playerCount })}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant={joined ? 'secondary' : 'ghost'}
                  onClick={() => onOpen(roomId)}
                  aria-label={joined ? t('RoomsList.openLabel', { room: name }) : t('RoomsList.joinLabel', { room: name })}
                >
                  {joined ? t('RoomsList.open') : t('Common.action.join')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <AlertDialog
        isOpen={joinError !== null}
        title={t('RoomsList.joinError.title')}
        message={joinError ? describeFailure(joinError.failure, joinErrorMessage(joinError, t)) : ''}
        onDismiss={() => dispatch(roomsSlice.Actions.clearJoinRoomError())}
      />
    </Panel>
  );
}
