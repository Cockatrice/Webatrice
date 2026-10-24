import { ArrowRight, UserRoundPlus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@app/components';
import { RouteEnum } from '@app/types';

import { buddyGamesEmptyKind } from '../homeModel';
import type { HomeData } from '../useHome';
import GameGrid, { type RenderGameCard } from './GameGrid';
import HomeEmpty from './HomeEmpty';
import SectionHead from './SectionHead';

export const BUDDY_GAMES_LIMIT = 6;

function BuddyGamesEmpty({ home }: { home: HomeData }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const room = home.usualRoom;
  const kind = buddyGamesEmptyKind(home.buddyCount, home.joinedRooms.length);

  if (kind === 'noBuddies') {
    return (
      <HomeEmpty
        icon={<UserRoundPlus size={17} />}
        actions={(
          <Button size="sm" icon={<Users size={14} aria-hidden />} onClick={() => navigate(RouteEnum.PEOPLE)}>
            {t('BuddyGames.findPeople')}
          </Button>
        )}
      >
        {t('BuddyGames.emptyNoBuddies')}
      </HomeEmpty>
    );
  }
  if (kind === 'notJoined') {
    return (
      <HomeEmpty
        icon={<Users size={17} />}
        actions={room && (
          <Button size="sm" iconRight={<ArrowRight size={14} aria-hidden />} onClick={home.play}>
            {t('BuddyGames.joinRoom', { room: room.info.name })}
          </Button>
        )}
      >
        {t('BuddyGames.emptyNotJoined')}
      </HomeEmpty>
    );
  }
  return <HomeEmpty icon={<Users size={17} />}>{t('BuddyGames.empty')}</HomeEmpty>;
}

export default function BuddyGames({ home, renderCard }: { home: HomeData; renderCard: RenderGameCard }) {
  const { t } = useTranslation();
  const room = home.usualRoom;
  const shown = home.buddyGames.slice(0, BUDDY_GAMES_LIMIT);

  let where: string | undefined;
  if (home.joinedRooms.length === 1) {
    where = t('BuddyGames.whereOne', { room: home.joinedRooms[0].info.name });
  } else if (home.joinedRooms.length > 1) {
    where = t('BuddyGames.whereMany', { count: home.joinedRooms.length });
  }

  return (
    <section className="flex shrink-0 flex-col gap-2.5" aria-labelledby="home-buddy-games">
      <SectionHead
        id="home-buddy-games"
        title={t('BuddyGames.title')}
        count={shown.length > 0 ? where : undefined}
        action={shown.length > 0 && room && home.usualRoomJoined && (
          <Button size="sm" variant="ghost" onClick={home.play}>
            {t('BuddyGames.allGames', { room: room.info.name })}
          </Button>
        )}
      />
      {shown.length === 0 ? (
        <BuddyGamesEmpty home={home} />
      ) : (
        <GameGrid>
          {shown.map(({ room: gameRoom, game }) => (
            <li key={`${gameRoom.info.roomId}:${game.info.gameId}`} className="flex min-w-0">
              {renderCard(gameRoom, game)}
            </li>
          ))}
        </GameGrid>
      )}
    </section>
  );
}
