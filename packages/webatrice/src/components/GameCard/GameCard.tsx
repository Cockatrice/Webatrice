import { memo, type ReactNode } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Game, GametypeMap } from '@cockatrice/datatrice';

import { AvailabilityBadge, Chip, SeatDots } from '../ds';
import { UserBadges } from '../UserBadges/UserBadges';
import { CountryFlag } from './CountryFlag';
import { cx } from '../../utils/cx';
import {
  gameAvailability,
  gameCardActions,
  gameRestrictions,
  gameTypeNames,
  spectatorTraits,
  type GameRestriction,
  type JoinBlock,
  type SpectatorTrait,
} from './gameCardModel';

export interface GameCardProps {
  game: Game;
  gametypeMap?: GametypeMap;
  overrideRestrictions?: boolean;
  alreadyJoined?: boolean;
  busy?: boolean;
  maxFormats?: number;
  headingLevel?: 2 | 3 | 4;
  className?: string;
  onJoin: (game: Game) => void;
  onSpectate: (game: Game) => void;
}

const ACTION_CLASS = [
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-ui px-3 text-[12.5px] font-semibold',
  'transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  'disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-transparent disabled:text-text-muted disabled:opacity-70',
].join(' ');

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-text-secondary">
      <span className="shrink-0 text-text-muted" aria-hidden>{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

function GameCard({
  game,
  gametypeMap,
  overrideRestrictions = false,
  alreadyJoined = false,
  busy = false,
  maxFormats = 2,
  headingLevel = 3,
  className,
  onJoin,
  onSpectate,
}: GameCardProps) {
  const { t } = useTranslation();
  const { info } = game;
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  const availability = gameAvailability(info);
  const actions = gameCardActions(info, { overrideRestrictions, alreadyJoined });
  const types = gameTypeNames(game, gametypeMap);
  const shownTypes = types.slice(0, maxFormats);
  const host = info.creatorInfo;
  const name = info.description || t('GameCard.untitled', { id: info.gameId });

  const restrictionLabel: Record<GameRestriction, string> = {
    password: t('GameCard.restriction.password'),
    buddiesOnly: t('GameCard.restriction.buddiesOnly'),
    registeredOnly: t('GameCard.restriction.registeredOnly'),
    openDecklists: t('GameCard.restriction.openDecklists'),
  };
  const traitLabel: Record<SpectatorTrait, string> = {
    canChat: t('GameCard.spectators.canChat'),
    seeHands: t('GameCard.spectators.seeHands'),
    password: t('GameCard.spectators.password'),
  };
  const blockLabel: Record<JoinBlock, string> = {
    started: t('GameCard.blocked.started'),
    full: t('GameCard.blocked.full'),
  };

  const restrictions = gameRestrictions(info).map((r) => restrictionLabel[r]);
  const spectatorLine = info.spectatorsAllowed
    ? [t('GameCard.spectators.watching', { count: info.spectatorsCount }), ...spectatorTraits(info).map((s) => traitLabel[s])].join(' · ')
    : t('GameCard.spectators.notAllowed');
  const joinReason = actions.joinBlock ? blockLabel[actions.joinBlock] : undefined;

  let joinLabel = t('GameCard.joinLabel', { name });
  if (joinReason) {
    joinLabel = t('GameCard.joinBlockedLabel', { name, reason: joinReason });
  } else if (actions.joinNeedsPassword) {
    joinLabel = t('GameCard.joinPasswordLabel', { name });
  }

  return (
    <article
      aria-label={name}
      className={cx(
        'flex w-full min-w-0 flex-col overflow-hidden rounded-ui-lg border border-border-subtle bg-bg-surface shadow-panel',
        className,
      )}
    >
      <header className="flex flex-col gap-2.5 border-b border-border-subtle bg-bg-sunken/70 px-pad pb-3 pt-pad">
        <div className="flex min-h-[22px] items-center gap-1.5">
          {shownTypes.map((type) => (
            <Chip key={type} outline>{type}</Chip>
          ))}
          {types.length > shownTypes.length && (
            <Chip outline title={types.slice(maxFormats).join(', ')}>
              {t('GameCard.moreFormats', { count: types.length - shownTypes.length })}
            </Chip>
          )}
          <span className="ml-auto">
            <AvailabilityBadge state={availability} />
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Heading className="flex min-w-0 font-display text-[18px] font-semibold leading-tight text-text-primary">
            {info.description ? (
              <span className="truncate" title={info.description}>{info.description}</span>
            ) : (
              <span className="truncate italic text-text-muted">{name}</span>
            )}
          </Heading>
          {host && (
            <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-text-secondary">
              <span className="shrink-0">{t('GameCard.hostedBy')}</span>
              <CountryFlag country={host.country} />
              <span className="truncate font-medium text-text-primary">{host.name}</span>
              <UserBadges userLevel={host.userLevel} size={12} />
            </span>
          )}
        </div>
      </header>
      <div className="flex flex-1 items-end gap-3 px-pad py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Meta icon={info.withPassword ? <Lock size={13} /> : <ShieldCheck size={13} />}>
            {restrictions.join(' · ') || t('GameCard.restriction.none')}
          </Meta>
          <Meta icon={info.spectatorsAllowed ? <Eye size={13} /> : <EyeOff size={13} />}>{spectatorLine}</Meta>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-text-primary">
            {t('GameCard.players', { taken: info.playerCount, max: info.maxPlayers })}
          </span>
          <SeatDots taken={Math.min(info.playerCount, info.maxPlayers)} max={info.maxPlayers} />
        </div>
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-border-subtle bg-bg-sunken/35 px-pad py-2">
        <button
          type="button"
          className={cx(ACTION_CLASS, 'text-accent hover:bg-accent/10')}
          disabled={!actions.canSpectate || busy}
          title={actions.canSpectate ? undefined : t('GameCard.spectators.notAllowed')}
          aria-label={t('GameCard.spectateLabel', { name })}
          onClick={() => onSpectate(game)}
        >
          {actions.spectateNeedsPassword && <Lock size={13} aria-hidden />}
          {t('GameCard.spectate')}
        </button>
        <button
          type="button"
          className={cx(ACTION_CLASS, 'border border-accent/70 text-accent hover:bg-accent/10')}
          disabled={!actions.canJoin || busy}
          title={joinReason}
          aria-label={joinLabel}
          onClick={() => onJoin(game)}
        >
          {actions.joinNeedsPassword && <Lock size={13} aria-hidden />}
          {t('GameCard.join')}
        </button>
      </footer>
    </article>
  );
}

export default memo(GameCard);
