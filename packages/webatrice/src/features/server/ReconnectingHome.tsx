import { useTranslation } from 'react-i18next';
import { Button, Panel } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';
import type { HomeSnapshot } from '../../services/storage/homeSnapshot';

export default function ReconnectingHome({ snapshot }: { snapshot: HomeSnapshot }) {
  const { t } = useTranslation();
  const room = snapshot.rooms.find(({ id }) => id === snapshot.usualRoomId);
  return (
    <Layout showNav={false}>
      <div className="flex h-full flex-col gap-gap overflow-y-auto bg-bg-base p-gap">
        <p role="status" className="rounded-ui border border-accent/40 bg-bg-surface px-pad py-3 text-text-primary">
          {t('ReconnectingHome.status')}
        </p>
        <section className="rounded-ui-lg border border-border-subtle bg-bg-surface px-7 py-6 shadow-panel">
          <p className="text-[12px] text-text-muted">
            {[snapshot.serverName, t('HomeHero.online', { count: snapshot.onlineCount }),
              t('HomeHero.games', { count: snapshot.gamesRunning })].filter(Boolean).join(' · ')}
          </p>
          <h1 className="font-display text-[30px] font-semibold text-text-primary">
            {t('HomeHero.welcome', { name: snapshot.userName })}
          </h1>
          {room && <Button disabled>{t('HomeHero.play', { room: room.name })}</Button>}
        </section>
        <div className="grid gap-gap lg:grid-cols-[minmax(0,1fr)_320px]">
          {room && (
            <Panel title={t('OpenGames.title', { room: room.name })}>
              {snapshot.openGames.length === 0 && <p>{t('OpenGames.empty', { room: room.name })}</p>}
              <ul className="flex flex-col gap-3">
                {snapshot.openGames.map(game => (
                  <li key={game.id} className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block">{game.name || t('GameCard.untitled', { id: game.id })}</span>
                      <span className="text-text-muted">{t('GameCard.players', { taken: game.players, max: game.maxPlayers })}</span>
                    </span>
                    <Button disabled>{t('GameCard.join')}</Button>
                  </li>
                ))}
              </ul>
              <Button disabled>{t('OpenGames.createGame')}</Button>
            </Panel>
          )}
          <div className="flex flex-col gap-gap">
            <Panel title={t('RoomsList.title')} count={t('RoomsList.count', { count: snapshot.rooms.length })}>
              <ul className="flex flex-col gap-3">
                {snapshot.rooms.map(item => (
                  <li key={item.id} className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block font-semibold">{item.name}</span>
                      <span className="text-text-muted">{t('RoomsList.summary', { games: item.games, people: item.people })}</span>
                    </span>
                    <Button disabled aria-label={t('RoomsList.joinLabel', { room: item.name })}>{t('Common.action.join')}</Button>
                  </li>
                ))}
              </ul>
            </Panel>
            {snapshot.buddyCount > 0 && (
              <Panel title={t('BuddiesOnline.title')} count={t('BuddiesOnline.count', {
                online: snapshot.buddiesOnline, total: snapshot.buddyCount,
              })}>
                <Button disabled>{t('BuddiesOnline.allBuddies')}</Button>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
