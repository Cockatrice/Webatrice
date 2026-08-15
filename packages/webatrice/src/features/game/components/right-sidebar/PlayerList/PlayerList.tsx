import { memo, useCallback, useState } from 'react';
import { Crown, Eye, User } from 'lucide-react';

import { games, server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useAppSelector } from '@app/store';
import { UserBadges } from '@app/components';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import { useGameId } from '../../ui/GameIdContext';
import PlayerListContextMenu, {
  type PlayerListMenuActions,
  type PlayerListMenuTarget,
} from './PlayerListContextMenu';
import {
  AdminNotesModal,
  BanFromServerModal,
  BanHistoryModal,
  UserDetailsModal,
  WarnHistoryModal,
  WarnUserModal,
} from './PlayerListDialogs';

/**
 * Right-rail player list — one row per seat.
 *
 * Ports fancy webatrice's PlayerRow visual: avatar circle (accent
 * gradient fallback since og's protocol carries no avatar URLs) plus
 * name + host crown icon on the top line and a small role tag
 * underneath. The row highlights when it's this player's turn.
 *
 * Right-click on a row opens `PlayerListContextMenu` (ports Cockatrice's
 * user_context_menu.cpp:348 role-gated menu). Modals for warn / ban /
 * admin notes / history are mounted here so a single instance handles
 * every row — the "target" moves as different rows are clicked, but
 * modal state (draft text, fetched payload) belongs to the list.
 */
function PlayerList() {
  const gameId = useGameId();
  const webClient = useWebClient();
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
  const isAdmin = useAppSelector((state) => server.Selectors.getIsUserAdmin(state));
  const buddyList = useAppSelector((state) => server.Selectors.getBuddyList(state));
  const ignoreList = useAppSelector((state) => server.Selectors.getIgnoreList(state));
  // Server-side user directory. Used two ways: (1) role gating on
  // Promote/Demote labels (need target's current mod/judge flags),
  // (2) the User details modal renders the full ServerInfo_User.
  const userInfoMap = useAppSelector((state) => state.server.userInfo);

  // Menu popup state: {anchor, target} or null. A single popup
  // handles every row; onContextMenu on each `<li>` calls
  // `openMenuFor` with the row's target snapshot.
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [menuTarget, setMenuTarget] = useState<PlayerListMenuTarget | null>(null);
  const dismissMenu = useCallback(() => {
    setMenuAnchor(null);
    setMenuTarget(null);
  }, []);

  // Modal state: one target per kind. Discriminated by which state
  // is non-null. Cleared on submit / cancel; history/notes lookups
  // are cached in redux so re-open is instant.
  const [userDetailsTarget, setUserDetailsTarget] = useState<string | null>(null);
  const [warnTarget, setWarnTarget] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [adminNotesTarget, setAdminNotesTarget] = useState<string | null>(null);
  const [warnHistoryTarget, setWarnHistoryTarget] = useState<string | null>(null);
  const [banHistoryTarget, setBanHistoryTarget] = useState<string | null>(null);

  const banHistoryRows = useAppSelector((state) =>
    banHistoryTarget ? server.Selectors.getBanHistoryByUser(state, banHistoryTarget) : undefined,
  );
  const warnHistoryRows = useAppSelector((state) =>
    warnHistoryTarget ? server.Selectors.getWarnHistoryByUser(state, warnHistoryTarget) : undefined,
  );
  const adminNotesText = useAppSelector((state) =>
    adminNotesTarget ? server.Selectors.getAdminNotesByUser(state, adminNotesTarget) : undefined,
  );

  const actions: PlayerListMenuActions = {
    onCopyHashToClipboard: (deckHash) => {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(deckHash);
      }
    },
    onOpenUserDetails: (userName) => setUserDetailsTarget(userName),
    onOpenPrivateChat: (_userName) => {
      // Private chat UI doesn't exist in the fancy sidebar yet — log
      // a hint so the click doesn't feel dead until we build it.
      console.info('[player-list] Private chat is not wired yet.');
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
    onOpenWarn: (userName) => setWarnTarget(userName),
    onOpenWarnHistory: (userName) => {
      setWarnHistoryTarget(userName);
      webClient.request.moderator.getWarnHistory(userName);
    },
    onOpenBan: (userName) => setBanTarget(userName),
    onOpenBanHistory: (userName) => {
      setBanHistoryTarget(userName);
      webClient.request.moderator.getBanHistory(userName);
    },
    onOpenAdminNotes: (userName) => {
      setAdminNotesTarget(userName);
      webClient.request.moderator.getAdminNotes(userName);
    },
    onAdjustMod: (userName, shouldBeMod) => {
      webClient.request.admin.adjustMod(userName, shouldBeMod, undefined);
    },
    onAdjustJudge: (userName, shouldBeJudge) => {
      webClient.request.admin.adjustMod(userName, undefined, shouldBeJudge);
    },
  };

  const submitWarn = useCallback(
    (args: { reason: string; removeMessagesMinutes: number }) => {
      if (!warnTarget) {
        return;
      }
      webClient.request.moderator.warnUser(
        warnTarget,
        args.reason,
        undefined,
        args.removeMessagesMinutes,
      );
      setWarnTarget(null);
    },
    [warnTarget, webClient],
  );
  const submitBan = useCallback(
    (args: {
      minutes: number;
      banByName: boolean;
      banByIp: boolean;
      banByClientId: boolean;
      reason: string;
      visibleReason: string;
      removeMessagesMinutes: number;
    }) => {
      if (!banTarget) {
        return;
      }
      // Cockatrice's ban dialog looks up address / clientid from the
      // server-side user record before firing; we mirror that so ban-
      // by-ip / ban-by-clientid have data to send.
      const info = userInfoMap[banTarget];
      webClient.request.moderator.banFromServer(
        args.minutes,
        args.banByName ? banTarget : undefined,
        args.banByIp ? info?.address : undefined,
        args.reason,
        args.visibleReason,
        args.banByClientId ? info?.clientid : undefined,
        args.removeMessagesMinutes,
      );
      setBanTarget(null);
    },
    [banTarget, webClient, userInfoMap],
  );
  const submitAdminNotes = useCallback(
    (notes: string) => {
      if (!adminNotesTarget) {
        return;
      }
      webClient.request.moderator.updateAdminNotes(adminNotesTarget, notes);
      setAdminNotesTarget(null);
    },
    [adminNotesTarget, webClient],
  );

  const entries = players ? Object.values(players) : [];

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
          <li className="px-3 py-2 text-xs italic text-text-muted">no players</li>
        )}
        {entries.map((p) => {
          const pid = p.properties.playerId;
          const name = p.properties.userInfo?.name ?? '(unknown)';
          const isActive = pid === activePlayerId;
          const isHost = pid === hostId;
          const isSpectator = !!p.properties.spectator;
          const isJudge = !!p.properties.judge;
          const isConceded = !!p.properties.conceded;
          const isSelfRow = pid === localPlayerId;
          const roleLabel = isJudge
            ? 'Judge'
            : isSpectator
              ? 'Spectator'
              : isConceded
                ? 'Conceded'
                : 'Player';
          // Target-user registered flag. Prefer the seat's embedded
          // userInfo; fall back to the server's userInfo map if it's
          // been more recently updated (moderation flips flags there
          // in real time via UserJoined/Left events).
          const wireUser = p.properties.userInfo ?? userInfoMap[name];
          const targetIsRegistered = wireUser
            ? (wireUser.userLevel & ServerInfo_User_UserLevelFlag.IsRegistered)
              === ServerInfo_User_UserLevelFlag.IsRegistered
            : false;
          return (
            <li
              key={pid}
              data-testid={`player-list-item-${pid}`}
              onContextMenu={(e) => {
                if (!name || name === '(unknown)') {
                  return;
                }
                e.preventDefault();
                setMenuAnchor({ x: e.clientX, y: e.clientY });
                setMenuTarget({
                  userName: name,
                  deckHash: p.properties.deckHash ?? '',
                  targetIsRegistered,
                  isSelf: isSelfRow,
                });
              }}
              className={[
                'flex items-center gap-2 px-3 py-2 transition-colors cursor-default',
                isActive ? 'bg-accent/10' : 'hover:bg-bg-elevated',
              ].join(' ')}
            >
              {/* Avatar — accent gradient fallback (og's protocol
                   doesn't carry avatar URLs today). */}
              <div
                className={[
                  'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
                  isConceded
                    ? 'bg-bg-elevated border border-border-subtle'
                    : 'bg-gradient-to-br from-accent-secondary to-accent',
                ].join(' ')}
              >
                <User size={12} className="text-white" />
              </div>

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
                      className="text-yellow-400 shrink-0"
                      aria-label="Host"
                    />
                  )}
                  {wireUser && (
                    <UserBadges userLevel={wireUser.userLevel} size={11} />
                  )}
                </div>
                <div className="text-[10px] text-text-muted inline-flex items-center gap-1">
                  {(isSpectator || isJudge) && <Eye size={10} />}
                  {roleLabel}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <PlayerListContextMenu
        anchor={menuAnchor}
        target={menuTarget}
        local={{
          isHost: hostId != null && hostId === localPlayerId,
          isRegistered,
          isModerator,
          isAdmin,
        }}
        buddyList={buddyList}
        ignoreList={ignoreList}
        targetUserFromServer={menuTarget ? userInfoMap[menuTarget.userName] : undefined}
        actions={actions}
        onDismiss={dismissMenu}
      />

      {userDetailsTarget && userDetailsResolved && (
        <UserDetailsModal
          user={userDetailsResolved}
          onClose={() => setUserDetailsTarget(null)}
        />
      )}
      {warnTarget && (
        <WarnUserModal
          userName={warnTarget}
          onCancel={() => setWarnTarget(null)}
          onConfirm={submitWarn}
        />
      )}
      {banTarget && (
        <BanFromServerModal
          userName={banTarget}
          onCancel={() => setBanTarget(null)}
          onConfirm={submitBan}
        />
      )}
      {adminNotesTarget && (
        <AdminNotesModal
          userName={adminNotesTarget}
          initialNotes={adminNotesText ?? ''}
          onCancel={() => setAdminNotesTarget(null)}
          onSave={submitAdminNotes}
        />
      )}
      {warnHistoryTarget && (
        <WarnHistoryModal
          userName={warnHistoryTarget}
          entries={warnHistoryRows}
          onClose={() => setWarnHistoryTarget(null)}
        />
      )}
      {banHistoryTarget && (
        <BanHistoryModal
          userName={banHistoryTarget}
          entries={banHistoryRows}
          onClose={() => setBanHistoryTarget(null)}
        />
      )}
    </>
  );
}

// Memoized so it skips re-render when unrelated game state changes
// (e.g. card hover / preview); still updates when the players map
// changes (joins / leaves, host swap, ready, conceded).
export default memo(PlayerList);
