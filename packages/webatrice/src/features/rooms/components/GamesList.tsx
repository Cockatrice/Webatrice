import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Gavel, Info, Link } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Game, Room } from '@cockatrice/datatrice';
import { Menu, MenuItem, MenuSeparator, VirtualRows } from '@app/components';
import { AlertDialog, ConfirmDialog } from '@app/dialogs';

import RoomGameInfoDialog from '../dialogs/RoomGameInfoDialog/RoomGameInfoDialog';
import GameRow, { gameName } from './GameRow';
import PasswordPopover from './PasswordPopover';
import QuickFilterBar, { SORT_KEYS } from './QuickFilterBar';
import { useElementWidth } from './useElementWidth';
import { useGameLink } from './useGameLink';
import { useNowSeconds } from './useNowSeconds';
import { useRoomGameFilters } from './useRoomGameFilters';
import { useRoomGames } from './useRoomGames';

interface GamesListProps {
  room: Room;
  header?: ReactNode;
}

const ROW_HEIGHT_FALLBACK = 40;
const WATCHING_MIN_WIDTH = 760;
const PASSWORD_TOGGLE_MIN_WIDTH = 980;
const COLUMNS_WIDE = 'minmax(0,1fr) 116px 92px 216px';
const COLUMNS_NARROW = 'minmax(0,1fr) 116px 216px';

function rowHeight(): number {
  const raw = typeof window === 'undefined'
    ? ''
    : getComputedStyle(document.documentElement).getPropertyValue('--row-h');
  const parsed = Number.parseFloat(raw);
  return Math.round((Number.isFinite(parsed) && parsed > 0 ? parsed : ROW_HEIGHT_FALLBACK) * 1.5);
}

export default function GamesList({ room, header }: GamesListProps) {
  const { t } = useTranslation();
  const games = useRoomGames(room);
  const {
    gameList, selectedGameId, sort, sortDescending: descending, onSort, listRef, getRowProps, onRowsRendered,
    handleSelect, handleActivate, onAction, onMore, moreMenu, password,
  } = games;
  const roomFilters = useRoomGameFilters(room.info.roomId);
  const nowSeconds = useNowSeconds();
  const gameLink = useGameLink();
  const [measureRef, width, section] = useElementWidth<HTMLElement>();
  const [gridHeader, setGridHeader] = useState<HTMLElement | null>(null);
  const [grid, setGrid] = useState<HTMLElement | null>(null);
  const watchingColumn = width >= WATCHING_MIN_WIDTH;
  const passwordInBar = width >= PASSWORD_TOGGLE_MIN_WIDTH;
  const columns = watchingColumn ? COLUMNS_WIDE : COLUMNS_NARROW;
  const [height] = useState(rowHeight);

  const passwordGameId = password?.gameId;
  const passwordAction = password?.action;
  const passwordAnchor = useCallback(
    () => (passwordGameId == null
      ? null
      : section?.querySelector<HTMLElement>(`[data-${passwordAction}-game="${passwordGameId}"]`) ?? null),
    [section, passwordGameId, passwordAction],
  );

  const renderGameRow = useCallback((game: Game, index: number, style: CSSProperties) => (
    <GameRow
      key={game.info.gameId}
      roomId={room.info.roomId}
      gameId={game.info.gameId}
      index={index}
      style={style}
      columns={columns}
      selected={game.info.gameId === selectedGameId}
      getRowProps={getRowProps}
      nowSeconds={nowSeconds}
      gametypeMap={room.gametypeMap}
      watchingColumn={watchingColumn}
      onSelect={handleSelect}
      onActivate={handleActivate}
      onAction={onAction}
      onMore={onMore}
    />
  ), [
    columns, selectedGameId, getRowProps, nowSeconds, room.info.roomId, room.gametypeMap, watchingColumn,
    handleSelect, handleActivate, onAction, onMore,
  ]);

  const sortLabel = t(SORT_KEYS[sort ?? 'custom']);

  return (
    <section
      ref={measureRef}
      aria-label={t('GamesList.heading', { room: room.info.name })}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-ui-lg border border-border-subtle bg-bg-surface shadow-panel"
    >
      {header}
      <div className={header ? 'px-pad pb-3' : 'px-pad pb-3 pt-3'}>
        <QuickFilterBar
          roomFilters={roomFilters}
          gametypeMap={room.gametypeMap}
          passwordInBar={passwordInBar}
          sort={sort}
          onSort={onSort}
        />
      </div>

      <div
        ref={setGrid}
        role="grid"
        tabIndex={-1}
        aria-label={t('GamesList.heading', { room: room.info.name })}
        aria-rowcount={gameList.length + 1}
        className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border-subtle"
      >
        <div role="rowgroup" className="shrink-0">
          <div
            ref={setGridHeader}
            role="row"
            aria-rowindex={1}
            className={[
              'grid items-center gap-gap border-b border-border-subtle bg-bg-elevated/40 px-pad py-1.5',
              'text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted [scrollbar-gutter:stable]',
            ].join(' ')}
            style={{ gridTemplateColumns: columns }}
          >
            <span
              role="columnheader"
              aria-sort={sort ? (descending ? 'descending' : 'ascending') : undefined}
              className="inline-flex items-center gap-1"
            >
              {t('GamesList.column.game', { sort: sortLabel })}
              {sort && (descending ? <ArrowDown size={11} aria-hidden /> : <ArrowUp size={11} aria-hidden />)}
            </span>
            <span role="columnheader">{t('GamesList.column.seats')}</span>
            {watchingColumn && <span role="columnheader">{t('GamesList.column.watching')}</span>}
            <span role="columnheader" className="pr-9 text-right">{t('GamesList.column.actions')}</span>
          </div>
        </div>
        {gameList.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center gap-2 px-4 py-8 text-center text-sm text-text-muted">
            {roomFilters.isActive && roomFilters.counts.total > 0 ? (
              <>
                <span>{t('GamesList.emptyFiltered')}</span>
                <button
                  type="button"
                  onClick={roomFilters.clear}
                  className={[
                    'rounded-ui-sm px-1 font-medium text-accent hover:underline',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                  ].join(' ')}
                >
                  {t('QuickFilterBar.clearAll')}
                </button>
              </>
            ) : (
              <span>{t('GamesList.empty')}</span>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <VirtualRows
              items={gameList}
              rowHeight={height}
              role="rowgroup"
              className="[scrollbar-gutter:stable]"
              renderRow={renderGameRow}
              listRef={listRef}
              onRowsRendered={onRowsRendered}
            />
          </div>
        )}
      </div>

      {moreMenu && (
        <Menu
          anchor={moreMenu.anchor}
          label={t('GameRow.more', { game: gameName(t, moreMenu.game) })}
          triggerRef={{ current: moreMenu.button }}
          onClose={games.closeMore}
        >
          <MenuItem icon={<Info size={14} />} onSelect={() => games.openInfo(moreMenu.game.info.gameId)}>
            {t('GamesList.action.info')}
          </MenuItem>
          <MenuItem
            icon={<Link size={14} />}
            disabled={!gameLink.available}
            disabledReason={gameLink.unavailableReason ?? undefined}
            onSelect={() => gameLink.copy(moreMenu.game.info)}
          >
            {t('GamesList.action.copyLink')}
          </MenuItem>
          {games.isJudgeUser && (
            <>
              <MenuSeparator />
              <MenuItem
                icon={<Gavel size={14} />}
                disabled={!moreMenu.state.canJoin}
                onSelect={() => games.judge(moreMenu.game.info.gameId, 'join')}
              >
                {t('GamesList.action.judge')}
              </MenuItem>
              <MenuItem
                icon={<Gavel size={14} />}
                disabled={!moreMenu.state.canSpectate}
                onSelect={() => games.judge(moreMenu.game.info.gameId, 'spectate')}
              >
                {t('GamesList.action.judgeSpectate')}
              </MenuItem>
            </>
          )}
        </Menu>
      )}

      <RoomGameInfoDialog
        game={games.infoGame}
        gametypeMap={room.gametypeMap}
        nowSeconds={nowSeconds}
        onClose={games.closeInfo}
      />
      <ConfirmDialog
        cancelDefault
        title={t('GameLink.confirm.title')}
        message={t('GameLink.full')}
        confirmLabel={t('GameLink.yes')}
        cancelLabel={t('GameLink.no')}
        isOpen={games.spectatorConfirmationRequired}
        onConfirm={games.confirmSpectatorJoin}
        onCancel={games.cancelSpectatorJoin}
      />
      {password && (
        <PasswordPopover
          key={password.gameId}
          anchor={passwordAnchor}
          fallback={gridHeader}
          focusFallback={grid}
          layoutKey={gameList}
          gameName={password.description || t('GameRow.untitled', { id: password.gameId })}
          spectating={password.action === 'spectate'}
          onSubmit={games.submitPassword}
          onCancel={games.cancelPassword}
        />
      )}
      <AlertDialog
        isOpen={games.joinError !== null}
        title={t('GamesList.error.title')}
        message={games.joinErrorMessage}
        onDismiss={games.clearJoinError}
      />
    </section>
  );
}
