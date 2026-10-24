import { memo, useCallback, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, useNavigate } from 'react-router-dom';
import { Crown, Eye, MoreVertical } from 'lucide-react';

import { games, server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useAppSelector } from '@app/store';
import { useAdminLocked } from '@app/hooks';
import { Avatar, UserBadges, isContextMenuKey, type MenuAnchor } from '@app/components';
import { MODERATION_MENU_LABEL_KEYS, useModerationMenu } from '@app/feature-widgets/moderation';
import { useReportUser } from '@app/dialogs';
import { RouteEnum } from '@app/types';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import { useGameId } from '../../ui/GameIdContext';
import { useGameReadOnly } from '../../ui/GameReadOnlyContext';
import { GAME_FOCUS_RING } from '../../ui/focusRing';
import type { ContextMenuItem } from '../../context-menus/ContextMenu/ContextMenu';
import PlayerListContextMenu, {
  type PlayerListMenuActions,
  type PlayerListMenuTarget,
} from './PlayerListContextMenu';
import { UserDetailsModal } from './PlayerListDialogs';

export type PlayerListKind = 'all' | 'players' | 'spectators';

interface PlayerListProps {
  kind?: PlayerListKind;
}

function PlayerList({ kind = 'all' }: PlayerListProps) {
  const { t } = useTranslation();
  const gameId = useGameId();
  const readOnly = useGameReadOnly();
  const webClient = useWebClient();
  const navigate = useNavigate();
  const players = useAppSelector((state) =>
    gameId != null ? games.Selectors.getPlayers(state, gameId) : undefined,
  );
  const activePlayerId = useAppSelector((state) =>
    gameId != null ? games.Selectors.getActivePlayerId(state, gameId) : undefined,
  );
  const hostId = useAppSelector((state) =>
    gameId != null ? games.Selectors.getHostId(state, gameId) : undefined,
  );
  const localPlayerId = useAppSelector((state) =>
    gameId != null ? games.Selectors.getLocalPlayerId(state, gameId) : undefined,
  );

  // Local user permissions — used to gate menu items. Read once at
  // the list level and passed into the menu so we don't re-select
  // per row (and don't create a new selector call for the popup that
  // only exists while it's open).
  const isRegistered = useAppSelector((state) => server.Selectors.getIsUserRegistered(state));
  const isModerator = useAppSelector((state) => server.Selectors.getIsUserModerator(state));
  const adminLocked = useAdminLocked();
  const buddyList = useAppSelector((state) => server.Selectors.getBuddyList(state));
  const ignoreList = useAppSelector((state) => server.Selectors.getIgnoreList(state));
  const userInfoMap = useAppSelector((state) => state.server.userInfo);
  const { reportingAvailable, openReportUser } = useReportUser();

  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [menuTarget, setMenuTarget] = useState<PlayerListMenuTarget | null>(null);
  const menuTriggerRef = useRef<HTMLElement | null>(null);
  const dismissMenu = useCallback(() => {
    setMenuAnchor(null);
    setMenuTarget(null);
  }, []);

  const [userDetailsTarget, setUserDetailsTarget] = useState<string | null>(null);

  const actions: PlayerListMenuActions = {
    onCopyHashToClipboard: (deckHash) => {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(deckHash);
      }
    },
    onOpenUserDetails: (userName) => setUserDetailsTarget(userName),
    // Cockatrice-parity: opens a per-user chat surface. In webatrice
    // the Player page (`/player/:name`) hosts a Tailwind PrivateChat
    // panel that reads/writes `state.server.messages[userName]` via
    // the same Command_Message / Event_UserMessage pair the desktop
    // client uses. Navigating opens (or focuses) that page's tab.
    onOpenPrivateChat: (userName) => {
      navigate(generatePath(RouteEnum.PLAYER, { name: userName }));
    },
    onAddBuddy: (userName) => webClient.request.session.addToBuddyList(userName),
    onRemoveBuddy: (userName) => webClient.request.session.removeFromBuddyList(userName),
    onAddIgnore: (userName) => webClient.request.session.addToIgnoreList(userName),
    onRemoveIgnore: (userName) => webClient.request.session.removeFromIgnoreList(userName),
    onKickFromGame: (userName) => {
      // Kick is player-id based, not user-name based. Look up the
      // matching player row to translate.
      if (gameId == null || !players) {
        return;
      }
      const match = Object.values(players).find(
        (p) => p.properties.userInfo?.name === userName,
      );
      if (!match) {
        return;
      }
      webClient.request.game.kickFromGame(gameId, { playerId: match.properties.playerId });
    },
    onReportUser: (userName) => openReportUser({ userName, gameId: gameId ?? undefined }),
  };

  const entries = (players ? Object.values(players) : []).filter((p) =>
    kind === 'all' || (kind === 'spectators') === !!p.properties.spectator);

  const menuTargetLevel = menuTarget
    ? (entries.find((p) => p.properties.userInfo?.name === menuTarget.userName)?.properties.userInfo
      ?? userInfoMap[menuTarget.userName])?.userLevel
    : undefined;
  const moderation = useModerationMenu(menuTarget?.userName ?? '', menuTargetLevel);
  const moderationItems = useMemo<ContextMenuItem[]>(
    () => moderation.groups.flatMap((group) => [
      { divider: true } as const,
      ...group.map(({ action, disabled }) => ({
        label: t(MODERATION_MENU_LABEL_KEYS[action]),
        disabled,
        onClick: () => moderation.open(action),
      })),
    ]),
    [moderation, t],
  );

  const userDetailsUser = userDetailsTarget ? userInfoMap[userDetailsTarget] : undefined;
  // Fallback: if the userInfo map hasn't picked up the target yet,
  // pull the last-known ServerInfo_User off their player row so the
  // modal has SOMETHING to render.
  const userDetailsFallback = userDetailsTarget && !userDetailsUser
    ? entries.find((p) => p.properties.userInfo?.name === userDetailsTarget)?.properties.userInfo
    : undefined;
  const userDetailsResolved = userDetailsUser ?? userDetailsFallback;

  return (
    <>
      <ul data-testid="player-list" className="pb-1">
        {entries.length === 0 && (
          <li className="px-3 py-2 text-xs italic text-text-muted">
            {t(kind === 'spectators' ? 'PlayerList.noSpectators' : 'PlayerList.empty')}
          </li>
        )}
        {entries.map((p) => {
          const pid = p.properties.playerId;
          const userName = p.properties.userInfo?.name;
          const name = userName ?? t('PlayerList.unknown');
          const isActive = pid === activePlayerId;
          const isHost = pid >= 0 && pid === hostId;
          const isSpectator = !!p.properties.spectator;
          const isJudge = !!p.properties.judge;
          const isConceded = !!p.properties.conceded;
          const isSelfRow = pid === localPlayerId;
          const roleLabel = t(isJudge
            ? 'PlayerList.role.judge'
            : isSpectator
              ? 'PlayerList.role.spectator'
              : isConceded
                ? 'PlayerList.role.conceded'
                : 'PlayerList.role.player');
          // Target-user registered flag. Prefer the seat's embedded
          // userInfo; fall back to the server's userInfo map if it's
          // been more recently updated (moderation flips flags there
          // in real time via UserJoined/Left events).
          const wireUser = p.properties.userInfo ?? userInfoMap[name];
          const targetIsRegistered = wireUser
            ? (wireUser.userLevel & ServerInfo_User_UserLevelFlag.IsRegistered)
              === ServerInfo_User_UserLevelFlag.IsRegistered
            : false;
          const openMenu = (anchor: MenuAnchor, trigger: HTMLElement | null) => {
            menuTriggerRef.current = trigger;
            setMenuAnchor(anchor);
            setMenuTarget({
              userName: userName!,
              deckHash: p.properties.deckHash ?? '',
              targetIsRegistered,
              isSelf: isSelfRow,
            });
          };
          const openBelow = (button: HTMLElement) =>
            openMenu({ rect: button.getBoundingClientRect(), placement: 'below', align: 'end' }, button);
          return (
            <li
              key={pid}
              data-testid={`player-list-item-${pid}`}
              onContextMenu={(e: MouseEvent<HTMLLIElement>) => {
                if (readOnly || !userName) {
                  return;
                }
                e.preventDefault();
                openMenu({ x: e.clientX, y: e.clientY }, null);
              }}
              className={[
                'flex items-center gap-2 px-3 py-2 board-motion transition-colors cursor-default',
                isActive ? 'bg-accent/10' : 'hover:bg-bg-elevated',
              ].join(' ')}
            >
              <span className={['flex shrink-0', isConceded ? 'opacity-50 grayscale' : ''].join(' ')}>
                <Avatar name={name} size={28} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className={[
                      'text-sm font-medium truncate',
                      isSpectator || isJudge || isConceded
                        ? 'text-text-muted'
                        : 'text-text-primary',
                    ].join(' ')}
                  >
                    {name}
                  </span>
                  {isHost && (
                    <Crown
                      size={11}
                      className="text-warning shrink-0"
                      aria-label={t('PlayerList.host')}
                    />
                  )}
                  {wireUser && (
                    <UserBadges userLevel={wireUser.userLevel} size={11} />
                  )}
                </div>
                <div className="text-[10px] text-text-muted inline-flex items-center gap-1">
                  {(isSpectator || isJudge) && <Eye size={10} aria-hidden />}
                  {roleLabel}
                </div>
              </div>

              {userName && (
                <button
                  type="button"
                  aria-label={t('PlayerList.moreActions', { name: userName })}
                  title={t('PlayerList.moreActions', { name: userName })}
                  aria-haspopup="menu"
                  aria-expanded={menuTarget?.userName === userName && menuAnchor != null}
                  onClick={(e) => openBelow(e.currentTarget)}
                  onKeyDown={(e) => {
                    if (isContextMenuKey(e)) {
                      e.preventDefault();
                      openBelow(e.currentTarget);
                    }
                  }}
                  className={[
                    'shrink-0 p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated board-motion transition-colors',
                    GAME_FOCUS_RING,
                  ].join(' ')}
                >
                  <MoreVertical size={14} aria-hidden />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {!readOnly && <PlayerListContextMenu
        anchor={menuAnchor}
        triggerRef={menuTriggerRef}
        target={menuTarget}
        local={{
          isHost: hostId != null && hostId >= 0 && hostId === localPlayerId,
          isRegistered,
          isModerator: isModerator && !adminLocked,
          canReport: reportingAvailable,
        }}
        buddyList={buddyList}
        ignoreList={ignoreList}
        moderationItems={moderationItems}
        actions={actions}
        onDismiss={dismissMenu}
      />}

      {!readOnly && userDetailsTarget && userDetailsResolved && (
        <UserDetailsModal
          user={userDetailsResolved}
          onClose={() => setUserDetailsTarget(null)}
        />
      )}
    </>
  );
}

// Memoized so it skips re-render when unrelated game state changes
// (e.g. card hover / preview); still updates when the players map
// changes (joins / leaves, host swap, ready, conceded).
export default memo(PlayerList);
