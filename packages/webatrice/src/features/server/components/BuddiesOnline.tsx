import { MessageSquare, Swords, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { generatePath, useNavigate } from 'react-router-dom';

import { Avatar, Button, CountryFlag, IconButton, Panel, UserBadges } from '@app/components';
import { useUserGames } from '@app/feature-widgets/user-games';
import { useOpenChat } from '@app/feature-widgets/chat-dock';
import { RouteEnum } from '@app/types';

import type { OnlineBuddy } from '../homeModel';

function BuddyRow({ buddy }: { buddy: OnlineBuddy }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userGames = useUserGames();
  const openChat = useOpenChat();
  const { name, country, userLevel } = buddy.user;
  const hosting = buddy.hosting?.info;

  return (
    <li className="flex items-center gap-2.5 rounded-ui-sm px-2 py-1.5 hover:bg-bg-elevated">
      <Avatar name={name} size={28} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <CountryFlag country={country} />
          <button
            type="button"
            onClick={() => navigate(generatePath(RouteEnum.PLAYER, { name }))}
            className={[
              'truncate rounded-ui-sm text-[13px] font-medium text-text-primary hover:text-accent',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
            ].join(' ')}
          >
            {name}
          </button>
          <UserBadges userLevel={userLevel} size={12} />
        </span>
        <span className="flex min-w-0 gap-1 text-[11.5px] text-text-muted">
          {hosting ? (
            <>
              <span className="shrink-0">{t('BuddiesOnline.hosting')}</span>
              <span className="truncate text-text-secondary">
                {hosting.description || t('BuddiesOnline.untitledGame', { id: hosting.gameId })}
              </span>
            </>
          ) : (
            t('BuddiesOnline.online')
          )}
        </span>
      </span>
      {userGames && (
        <IconButton size="sm" label={t('BuddiesOnline.showGames', { name })} onClick={() => userGames.open(name)}>
          <Swords size={14} aria-hidden />
        </IconButton>
      )}
      <IconButton size="sm" label={t('BuddiesOnline.message', { name })} onClick={() => openChat(name)}>
        <MessageSquare size={14} aria-hidden />
      </IconButton>
    </li>
  );
}

function BuddiesEmpty({ buddyCount }: { buddyCount: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-start gap-3 px-pad py-4">
      <p className="text-[13px] leading-snug text-text-secondary">{t('BuddiesOnline.empty', { count: buddyCount })}</p>
      <Button size="sm" icon={<Users size={14} aria-hidden />} onClick={() => navigate(RouteEnum.PEOPLE)}>
        {t('BuddiesOnline.allBuddies')}
      </Button>
    </div>
  );
}

export default function BuddiesOnline({ buddies, buddyCount }: { buddies: OnlineBuddy[]; buddyCount: number }) {
  const { t } = useTranslation();
  const empty = buddies.length === 0;
  return (
    <Panel
      title={t('BuddiesOnline.title')}
      count={buddyCount > 0 ? t('BuddiesOnline.count', { online: buddies.length, total: buddyCount }) : undefined}
      flush
      className={empty ? 'shrink-0' : 'min-h-[160px] flex-1'}
      bodyClassName="overflow-y-auto"
    >
      {empty ? (
        <BuddiesEmpty buddyCount={buddyCount} />
      ) : (
        <ul className="flex flex-col px-1.5 py-1.5">
          {buddies.map((buddy) => (
            <BuddyRow key={buddy.user.name} buddy={buddy} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
