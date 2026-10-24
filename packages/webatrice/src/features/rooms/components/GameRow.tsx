import { memo, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Eye, EyeOff, Lock, MoreHorizontal } from 'lucide-react';

import { games, rooms, type Game, type GametypeMap } from '@cockatrice/datatrice';
import { AvailabilityBadge, Button, Chip, IconButton, SeatDots, UserBadges, type Availability } from '@app/components';
import { useCanOverrideGameRestrictions, type GridRowProps } from '@app/hooks';
import { Images } from '@app/images';
import { useAppSelector } from '@app/store';
import { cx } from '@app/utils';

import { gameAge, gameAvailability, gameTypeNames, restrictionKeys, rowJoinState, type AgeLabel } from './gameRowModel';

export type RowAction = 'join' | 'spectate';

export interface GameRowProps {
  roomId: number;
  gameId: number;
  index: number;
  style: CSSProperties;
  columns: string;
  selected: boolean;
  getRowProps: (key: string) => GridRowProps;
  nowSeconds: number;
  gametypeMap: GametypeMap;
  watchingColumn: boolean;
  onSelect: (gameId: number) => void;
  onActivate: (gameId: number) => void;
  onAction: (gameId: number, action: RowAction) => void;
  onMore: (gameId: number, button: HTMLElement) => void;
}

const STRIPE: Record<Availability, string> = {
  open: 'bg-success',
  password: 'bg-warning',
  buddies: 'bg-accent',
  full: 'bg-text-muted',
  started: 'bg-info',
};

const MAX_SEAT_DOTS = 8;

const RESTRICTION_KEYS = {
  buddiesOnly: 'GameRow.restriction.buddiesOnly',
  registeredOnly: 'GameRow.restriction.registeredOnly',
  openDecklists: 'GameRow.restriction.openDecklists',
} as const;

const BLOCKED_KEYS = {
  pending: 'GameRow.blocked.pending',
  started: 'GameRow.blocked.started',
  full: 'GameRow.blocked.full',
  notAllowed: 'GameRow.blocked.notAllowed',
} as const;

export function gameName(t: TFunction, game: Game): string {
  return game.info.description || t('GameRow.untitled', { id: game.info.gameId });
}

function ageText(t: TFunction, age: AgeLabel): string {
  if (age.unit === 'new') {
    return t('GameRow.age.new');
  }
  return age.unit === 'minutes' ? t('GameRow.age.minutes', { count: age.count }) : t('GameRow.age.hours', { count: age.count });
}

function Watching({ game, className }: { game: Game; className?: string }) {
  const { t } = useTranslation();
  const { info } = game;
  if (!info.spectatorsAllowed) {
    return (
      <span className={cx('flex items-center gap-1.5 text-[12px] text-text-muted', className)}>
        <EyeOff size={14} aria-hidden />
        {t('GameRow.watching.none')}
      </span>
    );
  }
  const extras = [
    info.spectatorsCanChat && t('GameRow.watching.chat'),
    info.spectatorsOmniscient && t('GameRow.watching.hands'),
  ].filter(Boolean);
  return (
    <span
      className={cx('flex min-w-0 items-center gap-1.5 text-[12px] text-text-secondary', className)}
      title={t('GameRow.watching.label', { count: info.spectatorsCount })}
    >
      <Eye size={14} className="shrink-0 text-text-muted" aria-hidden />
      <span className="sr-only">{t('GameRow.watching.label', { count: info.spectatorsCount })}</span>
      <span className="tabular-nums" aria-hidden>{info.spectatorsCount}</span>
      {extras.length > 0 && <span className="truncate text-text-muted">· {extras.join(' · ')}</span>}
    </span>
  );
}

function stylesEqual(a: CSSProperties, b: CSSProperties): boolean {
  const keys = Object.keys(a) as (keyof CSSProperties)[];
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

function GameRow({
  roomId,
  gameId,
  index,
  style,
  columns,
  selected,
  getRowProps,
  nowSeconds,
  gametypeMap,
  watchingColumn,
  onSelect,
  onActivate,
  onAction,
  onMore,
}: GameRowProps) {
  const { t } = useTranslation();
  const game = useAppSelector((state) => rooms.Selectors.getRoomGames(state, roomId)[gameId]);
  const alreadyJoined = useAppSelector((state) => games.Selectors.getActiveGameIds(state).includes(gameId));
  const joinPending = useAppSelector(rooms.Selectors.getJoinGamePending);
  const overrideRestrictions = useCanOverrideGameRestrictions();
  if (!game) {
    return null;
  }
  const { info } = game;
  const rowProps = getRowProps(String(gameId));
  const state = rowJoinState(info, { override: overrideRestrictions, pending: joinPending, alreadyJoined });
  const availability = gameAvailability(info);
  const name = gameName(t, game);
  const formats = gameTypeNames(info, gametypeMap);
  const shownFormats = formats.length > 0 ? formats : game.gameType ? [game.gameType] : [];
  const rules = restrictionKeys(info).map((key) => t(RESTRICTION_KEYS[key]));
  const host = info.creatorInfo;
  const joinWhy = state.joinBlock ? t(BLOCKED_KEYS[state.joinBlock]) : undefined;
  const spectateWhy = state.spectateBlock ? t(BLOCKED_KEYS[state.spectateBlock]) : undefined;

  return (
    <div
      role="row"
      style={{ ...style, gridTemplateColumns: columns }}
      {...rowProps}
      aria-selected={selected}
      aria-rowindex={index + 2}
      onClick={() => onSelect(info.gameId)}
      onDoubleClick={() => onActivate(info.gameId)}
      className={cx(
        'relative grid cursor-pointer items-center gap-gap border-b border-border-subtle/70 px-pad transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        selected ? 'bg-accent/15 hover:bg-accent/20' : 'hover:bg-bg-elevated/40',
      )}
    >
      <span aria-hidden className={cx('absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r-full', STRIPE[availability])} />
      <div role="gridcell" className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          {info.withPassword && <Lock size={13} className="shrink-0 text-warning" aria-label={t('GameRow.passwordIcon')} />}
          <span
            className={cx(
              'truncate text-[14px] font-semibold',
              info.description ? 'text-text-primary' : 'italic text-text-muted',
            )}
            title={name}
          >
            {name}
          </span>
          {availability !== 'open' && (
            <span className="shrink-0">
              <AvailabilityBadge state={availability} />
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2 text-[12px] text-text-muted">
          {shownFormats.slice(0, 1).map((format) => (
            <Chip key={format} outline className="shrink-0">{format}</Chip>
          ))}
          {shownFormats.length > 1 && (
            <Chip outline className="shrink-0" title={shownFormats.slice(1).join(', ')}>+{shownFormats.length - 1}</Chip>
          )}
          {host && (
            <span className="flex shrink-0 items-center gap-1.5 text-text-secondary">
              {host.country && Images.Countries[host.country] && (
                <img
                  src={Images.Countries[host.country]}
                  alt={t(`Common.countries.${host.country.toUpperCase()}`, { defaultValue: host.country })}
                  className="h-3 w-auto shrink-0 rounded-[2px]"
                />
              )}
              <span className="max-w-[12rem] truncate font-medium text-text-primary">{host.name}</span>
              <UserBadges userLevel={host.userLevel} size={12} />
            </span>
          )}
          <span aria-hidden>·</span>
          <span className="shrink-0 tabular-nums">{ageText(t, gameAge(info.startTime, nowSeconds))}</span>
          {rules.length > 0 && (
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden>·</span>
              <span className="truncate">{rules.join(' · ')}</span>
            </span>
          )}
          {!watchingColumn && (
            <>
              <span aria-hidden>·</span>
              <Watching game={game} className="shrink-0" />
            </>
          )}
        </div>
      </div>
      <div
        role="gridcell"
        className="flex items-center gap-2"
        title={t('DesignSystem.seats', { taken: info.playerCount, max: info.maxPlayers })}
      >
        {info.maxPlayers <= MAX_SEAT_DOTS && <SeatDots taken={info.playerCount} max={info.maxPlayers} />}
        <span className="whitespace-nowrap text-[12px] tabular-nums text-text-secondary" aria-hidden={info.maxPlayers <= MAX_SEAT_DOTS}>
          {info.playerCount} / {info.maxPlayers}
        </span>
      </div>
      {watchingColumn && (
        <div role="gridcell" className="min-w-0">
          <Watching game={game} />
        </div>
      )}
      <div role="gridcell" className="flex items-center justify-end gap-1" onDoubleClick={(event) => event.stopPropagation()}>
        <Button
          size="sm"
          variant="ghost"
          data-spectate-game={info.gameId}
          disabled={!state.canSpectate}
          title={spectateWhy}
          aria-label={spectateWhy
            ? t('GameRow.spectateBlocked', { game: name, reason: spectateWhy })
            : t('GameRow.spectate', { game: name })}
          icon={state.spectateNeedsPassword ? <Lock size={13} aria-hidden /> : undefined}
          onClick={(event) => {
            event.stopPropagation();
            onAction(info.gameId, 'spectate');
          }}
        >
          {t('GamesList.action.spectate')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!state.canJoin}
          title={joinWhy}
          data-join-game={info.gameId}
          aria-label={joinWhy
            ? t('GameRow.joinBlocked', { game: name, reason: joinWhy })
            : state.joinNeedsPassword ? t('GameRow.joinWithPassword', { game: name }) : t('GameRow.join', { game: name })}
          icon={state.joinNeedsPassword ? <Lock size={13} aria-hidden /> : undefined}
          className="border border-accent/70"
          onClick={(event) => {
            event.stopPropagation();
            onAction(info.gameId, 'join');
          }}
        >
          {t('Common.action.join')}
        </Button>
        <IconButton
          size="sm"
          label={t('GameRow.more', { game: name })}
          aria-haspopup="menu"
          onClick={(event) => {
            event.stopPropagation();
            onMore(info.gameId, event.currentTarget);
          }}
        >
          <MoreHorizontal size={16} aria-hidden />
        </IconButton>
      </div>
    </div>
  );
}

export default memo(GameRow, (previous, next) =>
  previous.roomId === next.roomId
  && previous.gameId === next.gameId
  && previous.index === next.index
  && stylesEqual(previous.style, next.style)
  && previous.columns === next.columns
  && previous.selected === next.selected
  && previous.getRowProps === next.getRowProps
  && previous.nowSeconds === next.nowSeconds
  && previous.gametypeMap === next.gametypeMap
  && previous.watchingColumn === next.watchingColumn
  && previous.onSelect === next.onSelect
  && previous.onActivate === next.onActivate
  && previous.onAction === next.onAction
  && previous.onMore === next.onMore);

