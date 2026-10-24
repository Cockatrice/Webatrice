import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import type { CreateGameParams } from '@cockatrice/sockatrice/generated';

import { AuthGuard, Button } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';
import type { RoomRouteState } from '@app/types';

import GamesList from './components/GamesList';
import RoomChat from './components/RoomChat';
import RoomUsers from './components/RoomUsers';
import CreateGameDialog from './dialogs/CreateGameDialog/CreateGameDialog';
import { useRoom } from './useRoom';

import './Room.css';

const Room = () => {
  const { t } = useTranslation();
  const { roomId, room, roomMessages, handleRoomSay, handleCreateGame } = useRoom();
  const location = useLocation();
  const navigate = useNavigate();
  const createRequested = Boolean((location.state as RoomRouteState | null)?.createGame);
  const [createOpen, setCreateOpen] = useState(createRequested);

  useEffect(() => {
    if (createRequested) {
      setCreateOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [createRequested, location.pathname, navigate]);

  if (!room) {
    return null;
  }

  const { name, description } = room.info;
  const submitCreate = (params: CreateGameParams) => {
    handleCreateGame(params);
    setCreateOpen(false);
  };

  return (
    <Layout className="room-view">
      <AuthGuard />

      <div className="room-view__grid grid h-full min-h-0 gap-gap bg-bg-base p-gap">
        <div className="min-h-0 min-w-0">
          <GamesList
            room={room}
            header={
              <header className="flex min-h-[60px] shrink-0 items-center gap-3 px-pad pb-2 pt-3">
                <h1 id="room-view-title" className="shrink-0 font-display text-[20px] font-semibold text-text-primary">
                  <Trans i18nKey="Room.title" values={{ room: name }} components={{ room: <span className="text-accent" /> }} />
                </h1>
                {description && (
                  <p className="min-w-0 truncate text-[12.5px] text-text-muted" title={description}>{description}</p>
                )}
                <Button
                  variant="primary"
                  className="ml-auto shrink-0"
                  icon={<Plus size={16} aria-hidden />}
                  onClick={() => setCreateOpen(true)}
                >
                  {t('Room.createGame')}
                </Button>
              </header>
            }
          />
        </div>
        <div className="row-span-2 min-h-0 min-w-0">
          <RoomUsers roomId={roomId} roomName={name} />
        </div>
        <div className="min-h-0 min-w-0">
          <RoomChat
            roomId={roomId}
            roomName={name}
            messages={roomMessages}
            users={room.users}
            onSay={handleRoomSay}
          />
        </div>
      </div>

      <CreateGameDialog
        isOpen={createOpen}
        roomName={name}
        gametypeMap={room.gametypeMap}
        onCancel={() => setCreateOpen(false)}
        onSubmit={submitCreate}
      />
    </Layout>
  );
};

export default Room;
