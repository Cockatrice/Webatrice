import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { AuthGuard } from '@app/components';
import { ReportChatScope, useReportUser } from '@app/dialogs';
import { Images } from '@app/images';
import { Layout } from '@app/feature-wrappers/layout';
import { MODERATION_MENU_LABEL_KEYS, useModerationMenu } from '@app/feature-widgets/moderation';
import { useUserGames } from '@app/feature-widgets/user-games';
import { formatAccountAge, formatUserLevel } from '@app/utils';
import { PrivateChat } from '@app/feature-widgets/chat-dock';
import { usePlayer } from './usePlayer';

import './Player.css';

const Player = () => {
  const { t, i18n } = useTranslation();
  const {
    name,
    userInfo,
    currentUser,
    isSelf,
    isABuddy,
    isIgnored,
    conversation,
    isOnline,
    avatarUrl: avatar,
    getChatContext,
    onAddBuddy,
    onRemoveBuddy,
    onAddIgnore,
    onRemoveIgnore,
    onSendMessage,
  } = usePlayer();
  const moderation = useModerationMenu(name ?? '', userInfo?.userLevel);

  const { canReportUser, openReportUser } = useReportUser();
  const userGames = useUserGames();
  const countryCode = userInfo?.country?.toUpperCase() ?? '';

  return (
    <Layout>
      <AuthGuard />
      {/*
       * Two-column layout: profile card on the left (unchanged MUI
       * card), private-chat panel on the right. The chat panel is
       * hidden when viewing your own profile (Cockatrice-parity;
       * user_context_menu.cpp:376 disables Private chat on self).
       * `h-[calc(100vh-<topbar>)]` gives the chat a bounded height so
       * its internal scroll region works — Layout mounts TopBar (~56px)
       * above this row.
       */}
      <div className="player-view flex flex-row gap-4 items-stretch h-[calc(100vh-56px)]">
        <Paper className="player-view__card" elevation={2}>
          <Typography variant="h5" className="player-view__name">
            {t('Player.title')}
          </Typography>

          {!userInfo && (
            <Typography className="player-view__empty">{t('Player.action.notFound')}</Typography>
          )}

          {userInfo && (
            <>
              <div className="player-view__avatar-wrapper">
                {avatar
                  ? <img className="player-view__avatar" src={avatar} alt={name ?? ''} />
                  : <div className="player-view__avatar" aria-hidden="true" />}
              </div>

              <Typography variant="h6" className="player-view__name">{userInfo.name}</Typography>
              <Typography className="player-view__level-badge">
                {formatUserLevel(t, userInfo.userLevel, userInfo.privlevel)}
              </Typography>

              <div className="player-view__details">
                <span className="player-view__label">{t('Player.label.realName')}</span>
                <span>{userInfo.realName || '—'}</span>

                <span className="player-view__label">{t('Player.label.location')}</span>
                <span>
                  {countryCode && (
                    <img
                      className="player-view__country-flag"
                      src={Images.Countries[userInfo.country]}
                      alt=""
                    />
                  )}
                  {countryCode || '—'}
                </span>

                <span className="player-view__label">{t('Player.label.userLevel')}</span>
                <span>{formatUserLevel(t, userInfo.userLevel, userInfo.privlevel)}</span>

                <span className="player-view__label">{t('Player.label.accountAge')}</span>
                <span>{formatAccountAge(t, userInfo.accountageSecs, userInfo.userLevel, i18n.language)}</span>
              </div>

              {!isSelf && (
                <div className="player-view__actions">
                  <Button variant="outlined" onClick={isABuddy ? onRemoveBuddy : onAddBuddy}>
                    {isABuddy ? t('Player.action.removeBuddy') : t('Player.action.addBuddy')}
                  </Button>
                  <Button variant="outlined" onClick={isIgnored ? onRemoveIgnore : onAddIgnore}>
                    {isIgnored ? t('Player.action.removeIgnore') : t('Player.action.addIgnore')}
                  </Button>
                  {name && userGames && (
                    <Button variant="outlined" disabled={!isOnline} onClick={() => userGames.open(name)}>
                      {t('UserGamesDialog.menu.showGames')}
                    </Button>
                  )}
                  {name && canReportUser(name) && (
                    <Button variant="outlined" color="warning"
                      onClick={() => openReportUser({ userName: name, chatContext: getChatContext() })}
                    >
                      {t('ReportUserDialog.menuItem')}
                    </Button>
                  )}
                </div>
              )}

              {moderation.groups.length > 0 && (
                <div className="player-view__actions" role="group" aria-label={t('Player.moderation')}>
                  {moderation.groups.flat().map(({ action, disabled }) => (
                    <Button key={action} variant="outlined" disabled={disabled} onClick={() => moderation.open(action)}>
                      {t(MODERATION_MENU_LABEL_KEYS[action])}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
        </Paper>

        {!isSelf && name && (
          <div className="flex-1 min-w-0 min-h-0">
            <ReportChatScope getChatContext={getChatContext}>
              <PrivateChat
                peerName={name}
                selfName={currentUser?.name ?? null}
                entries={conversation}
                isOnline={isOnline}
                isIgnored={isIgnored}
                onSend={onSendMessage}
              />
            </ReportChatScope>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Player;
