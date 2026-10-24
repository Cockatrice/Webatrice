import { AuthGuard } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';

import BuddiesOnline from './components/BuddiesOnline';
import HomeGames from './components/HomeGames';
import HomeHero from './components/HomeHero';
import RecentDecks from './components/RecentDecks';
import ServerAnnouncement from './components/ServerAnnouncement';
import RoomsList from './RoomsList';
import { useHome } from './useHome';
import { useStartupRoom } from './useStartupRoom';

const Server = () => {
  const home = useHome();
  useStartupRoom();

  return (
    <Layout>
      <AuthGuard />
      <div
        className={[
          'flex h-full min-h-0 flex-col gap-gap overflow-y-auto bg-bg-base p-gap',
          'lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:overflow-hidden min-[1400px]:grid-cols-[minmax(0,1fr)_372px]',
        ].join(' ')}
      >
        <div className="flex min-w-0 shrink-0 flex-col gap-gap lg:min-h-0 lg:shrink lg:overflow-y-auto">
          <HomeHero home={home} />
          <HomeGames home={home} />
          <RecentDecks />
        </div>
        <div className="flex min-w-0 shrink-0 flex-col gap-gap lg:min-h-0 lg:shrink lg:overflow-y-auto">
          <ServerAnnouncement message={home.message} />
          <RoomsList rooms={home.roomList} joinedRoomIds={home.joinedRoomIds} onOpen={home.openRoom} />
          {home.buddyCount > 0 && <BuddiesOnline buddies={home.buddiesOnline} buddyCount={home.buddyCount} />}
        </div>
      </div>
    </Layout>
  );
};

export default Server;
