import { ArrowRight, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@app/components';
import { useRecentDecks } from '@app/hooks';
import { recentDeckArtUrl } from '@app/services';

import type { HomeData } from '../useHome';

export default function HomeHero({ home }: { home: HomeData }) {
  const { t } = useTranslation();
  const recent = useRecentDecks();
  const art = recent.map(recentDeckArtUrl).find(Boolean) ?? null;
  const room = home.usualRoom;

  const status = [
    home.serverName,
    t('HomeHero.online', { count: home.onlineCount }),
    t('HomeHero.games', { count: home.gamesRunning }),
  ].filter(Boolean).join(' · ');

  let roomLine = t('HomeHero.noRooms');
  if (room && home.usualRoomJoined) {
    roomLine = t('HomeHero.usualRoomJoined', { room: room.info.name, games: room.info.gameCount, open: home.usualRoomOpenSeats });
  } else if (room) {
    roomLine = t('HomeHero.usualRoom', { room: room.info.name, games: room.info.gameCount });
  }

  return (
    <section
      className="relative flex min-h-[212px] shrink-0 overflow-hidden rounded-ui-lg border border-border-subtle bg-bg-surface shadow-panel"
    >
      {art && (
        <>
          <img
            src={art}
            alt=""
            draggable={false}
            className="absolute inset-y-0 right-0 h-full w-[62%] object-cover object-[50%_30%]"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-bg-surface from-[42%] via-bg-surface/80 via-[60%] to-bg-surface/10"
          />
        </>
      )}
      <div className="relative flex flex-col justify-center gap-3 px-7 py-6">
        <span className="text-[12px] font-medium text-text-muted">{status}</span>
        <h1 className="font-display text-[30px] font-semibold leading-tight text-text-primary">
          {t('HomeHero.welcome', { name: home.userName })}
        </h1>
        <p className="max-w-[46ch] text-[14px] text-text-secondary">{roomLine}</p>
        {room && (
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Button size="lg" variant="primary" iconRight={<ArrowRight size={17} aria-hidden />} onClick={home.play}>
              {t('HomeHero.play', { room: room.info.name })}
            </Button>
            {home.usualRoomJoined && (
              <Button size="lg" icon={<Plus size={17} aria-hidden />} onClick={home.createGame}>
                {t('HomeHero.createGame')}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
