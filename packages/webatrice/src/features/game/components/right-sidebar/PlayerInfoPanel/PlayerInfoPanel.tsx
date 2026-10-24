import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, MoreVertical } from 'lucide-react';
import { useAnimationPreference } from '@app/hooks';

import { isContextMenuKey, ManaSymbols, type MenuAnchor } from '@app/components';
import { ContextMenuPopup } from '../../context-menus/ContextMenu/ContextMenu';
import { usePendingTargetContext } from '../../ui/PendingTargetContext';
import { makeCardKey, useCardRegistry } from '../../../utils/CardRegistry/CardRegistryContext';
import { usePlayerSeatContext } from '../../ui/PlayerBoard/PlayerSeatContext';
import { useCardPreviewActions } from '../../ui/CardPreviewContext';
import { getScryfallUrlByIdOrExactName } from '@app/services';
import { cx } from '@app/utils';
import { ScryfallImageSize } from '@cockatrice/datatrice';
import { CARD_WIDTH } from '../../ui/SeatCard/cardSize';
import { useValueFlash } from '../../ui/ValueFlash/useValueFlash';
import ValueFlashOverlay from '../../ui/ValueFlash/ValueFlashOverlay';
import ZoneBackground from '../../ui/ZoneBackground/ZoneBackground';
import ZoneStack from '../../ui/ZoneStack/ZoneStack';
import { MANA_COLORS } from './manaColors';
import {
  INFO_FONT_MAX_PX,
  INFO_FONT_MIN_PX,
  INFO_GAP_EM,
  INFO_PADDING_EM,
  LIFE_TILE_EM,
  MANA_GRID_COLUMNS,
  MANA_GRID_GAP_PX,
  MANA_PIP_EM,
} from '../../ui/seatFit';
import { GAME_FOCUS_RING } from '../../ui/focusRing';
import { OVER_ART_ICON_SHADOW, OVER_ART_SHADOW_LIFE, OVER_ART_SHADOW_NAME, OVER_ART_SHADOW_PIP } from '../../ui/seatColors/seatColors';

function counterStep(event: KeyboardEvent): 1 | -1 | 0 {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return 0;
  }
  return event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
}

function ManaPip({
  symbol,
  label,
  count,
  tint,
  onIncrement,
  onDecrement,
  tabIndex,
  onFocus,
}: {
  symbol: string;
  label: string;
  count: number;
  tint: string;
  /** Left-click handler. When present the pip becomes clickable and
   *  fires the Cockatrice canonical ±1 counter change on the server. */
  onIncrement?: () => void;
  /** Right-click handler; suppresses the browser context menu. */
  onDecrement?: () => void;
  tabIndex?: number;
  onFocus?: () => void;
}) {
  const clickable = !!onIncrement || !!onDecrement;
  // Standard MTG mana symbols Scryfall has SVGs for at
  // https://svgs.scryfall.io/card-symbols/<X>.svg. The "Other" pool
  // slot (O → Cockatrice's `storm` counter) isn't a real mana symbol
  // and 404s from Scryfall; render a solid tinted circle for those
  // instead so we don't ship a broken-image icon.
  const hasScryfallSvg = /^[WUBRGCX]$/.test(symbol);
  // Pip size dropped from fancy's 2.75em to 2em so the 3-wide grid
  // fits inside the compact info column without widening it.
  return (
    <div
      className={['relative rounded-full', clickable ? GAME_FOCUS_RING : ''].join(' ')}
      style={{
        width: '100%',
        aspectRatio: '1',
        cursor: clickable ? 'pointer' : undefined,
      }}
      title={label}
      role={clickable ? 'spinbutton' : undefined}
      tabIndex={clickable ? tabIndex : undefined}
      aria-label={clickable ? label : undefined}
      aria-valuenow={clickable ? count : undefined}
      aria-valuemin={clickable ? 0 : undefined}
      onFocus={onFocus}
      onKeyDown={clickable ? (e) => {
        const step = counterStep(e);
        if (step !== 0) {
          e.preventDefault();
          (step > 0 ? onIncrement : onDecrement)?.();
        }
      } : undefined}
      onClick={onIncrement}
      onContextMenu={
        onDecrement
          ? (e) => {
            e.preventDefault();
            onDecrement();
          }
          : undefined
      }
    >
      {hasScryfallSvg ? (
        <ManaSymbols cost={`{${symbol}}`} size="100%" className="absolute inset-0" />
      ) : (
        // Solid tinted disc for symbols without a Scryfall SVG (e.g.
        // "O" = Cockatrice's Other/storm). Full-opacity fill with a
        // subtle dark ring reads as "physical pip" without needing
        // the ManaSymbols SVG underneath.
        <div
          className="absolute inset-0 rounded-full pointer-events-none border border-over-art-backdrop/50"
          style={{ backgroundColor: tint }}
        />
      )}
      {/* 50% color wash sitting on top of the pip. Skipped for pips
          that already have a full-opacity disc (see above) so their
          color isn't washed out to 50%. */}
      {hasScryfallSvg && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ backgroundColor: tint, opacity: 0.5 }}
        />
      )}
      {!clickable && <span className="sr-only">{label}</span>}
      <span
        className={
          'absolute inset-0 flex items-center justify-center text-over-art-text font-bold text-[0.75em] '
          + 'tabular-nums pointer-events-none'
        }
        style={{ textShadow: OVER_ART_SHADOW_PIP }}
        aria-hidden={clickable || undefined}
      >
        {count}
      </span>
    </div>
  );
}

const INFO_COLUMN_STYLE = {
  fontSize: `clamp(${INFO_FONT_MIN_PX}px, calc(${CARD_WIDTH} * ${INFO_FONT_MAX_PX} / 72), ${INFO_FONT_MAX_PX}px)`,
  padding: `${INFO_PADDING_EM}em`,
  gap: `${INFO_GAP_EM}em`,
};
const MANA_GRID_STYLE = { gap: `${MANA_GRID_GAP_PX}px` };
const MANA_PIP_SLOT_STYLE = {
  width: `min(${MANA_PIP_EM}em, calc((100% - ${(MANA_GRID_COLUMNS - 1) * MANA_GRID_GAP_PX}px) / ${MANA_GRID_COLUMNS}))`,
};
const INFO_STACK_STYLE = { gap: `${INFO_GAP_EM}em` };

const NO_MODIFIERS = (event: KeyboardEvent) => !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;

function PlayerMenuButton() {
  const { t } = useTranslation();
  const { isSelf, name, battlefieldMenuItems, opponentBattlefieldMenuItems } = usePlayerSeatContext();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const openBelow = (button: HTMLElement) => setAnchor({
    rect: button.getBoundingClientRect(),
    placement: 'below',
    align: 'end',
  });
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={t('PlayerInfoPanel.playerMenu', { name })}
        aria-haspopup="menu"
        aria-expanded={anchor != null}
        onClick={(e) => (anchor ? setAnchor(null) : openBelow(e.currentTarget))}
        onKeyDown={(e) => {
          if (isContextMenuKey(e)) {
            e.preventDefault();
            openBelow(e.currentTarget);
          }
        }}
        className={[
          'absolute top-[0.25em] right-[0.25em] z-20 rounded p-[0.15em] text-over-art-text',
          'hover:bg-over-art-backdrop/40',
          GAME_FOCUS_RING,
        ].join(' ')}
      >
        <MoreVertical size="1em" aria-hidden />
      </button>
      {anchor && (
        <ContextMenuPopup
          items={isSelf ? battlefieldMenuItems : opponentBattlefieldMenuItems}
          anchor={anchor}
          label={t('PlayerBoard.playerMenu', { name })}
          onClose={() => setAnchor(null)}
          triggerRef={buttonRef}
        />
      )}
    </>
  );
}

export default function PlayerInfoPanel() {
  const {
    counterCommands,
    deck,
    isSelf,
    life,
    lifeControl,
    manaCounters,
    name,
    openLifePrompt,
    playerId,
    seat,
    seatGrid,
    setLife,
  } = usePlayerSeatContext();
  const { t } = useTranslation();
  const { setHoveredCard } = useCardPreviewActions();
  const commander = deck.find((c) => c.commander);
  const backdrop = seat.avatarUrl
    ?? (commander ? getScryfallUrlByIdOrExactName(commander, ScryfallImageSize.ArtCrop) : null);
  const { pending, pickArrowAt } = usePendingTargetContext();
  const arrowPicking = pending?.kind === 'arrow';
  const registry = useCardRegistry();
  const blockRef = useRef<HTMLDivElement | null>(null);
  const lifeRef = useRef<HTMLDivElement | null>(null);
  const lifeFocused = useRef(false);
  const pickSource = useRef(pending?.source);
  if (pending) {
    pickSource.current = pending.source;
  }
  const wasPicking = useRef(arrowPicking);
  useLayoutEffect(() => {
    const ended = wasPicking.current && !arrowPicking;
    wasPicking.current = arrowPicking;
    const active = document.activeElement;
    if (!ended || isSelf || !lifeFocused.current || (active !== lifeRef.current && active !== document.body && active != null)) {
      return;
    }
    lifeFocused.current = false;
    const source = pickSource.current;
    const card = source && registry?.get(makeCardKey(source.playerId, source.zone, source.cardId));
    const target = card?.isConnected ? card : blockRef.current?.querySelector<HTMLElement>('button[aria-haspopup="menu"]');
    target?.focus();
  }, [arrowPicking, isSelf, registry]);
  const [manaFocus, setManaFocus] = useState(0);
  const lifeFlash = useValueFlash(lifeControl?.value, useAnimationPreference('lifeCounterAnimations'));
  // Mana pool: read from the wired `manaCounters` when available
  // (Redux-authoritative), fall back to zeros during pre-hydration.
  // Local mana pool is per-player and matches Cockatrice's
  // Servatrice-created counters (w/u/b/r/g/x/storm) — see
  // server_player.cpp:96-102.
  const manaPool: Record<'W' | 'U' | 'B' | 'R' | 'G' | 'C' | 'O', number> = {
    W: manaCounters?.W?.count ?? 0,
    U: manaCounters?.U?.count ?? 0,
    B: manaCounters?.B?.count ?? 0,
    R: manaCounters?.R?.count ?? 0,
    G: manaCounters?.G?.count ?? 0,
    C: manaCounters?.C?.count ?? 0,
    O: manaCounters?.O?.count ?? 0,
  };

  return (
    <div
      className={cx(
        'relative isolate flex min-h-0 flex-col overflow-y-auto border-r border-border-subtle bg-bg-surface/70',
      )}
      style={{ ...seatGrid.info, ...INFO_COLUMN_STYLE }}
    >
      <ZoneBackground zone="playerInfo" />
      <div className="relative" ref={blockRef}>
        <div
          ref={lifeRef}
          onFocus={() => {
            lifeFocused.current = true;
          }}
          onBlur={(e) => {
            if (e.relatedTarget != null) {
              lifeFocused.current = false;
            }
          }}
          role={isSelf ? 'spinbutton' : arrowPicking ? 'button' : 'group'}
          tabIndex={isSelf || arrowPicking ? 0 : undefined}
          aria-label={t('PlayerInfoPanel.life', { name })}
          aria-valuenow={isSelf ? life : undefined}
          title={isSelf ? t('PlayerInfoPanel.lifeHint') : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && NO_MODIFIERS(e) && pickArrowAt(e.currentTarget)) {
              e.preventDefault();
              return;
            }
            if (!isSelf) {
              return;
            }
            const step = counterStep(e);
            if (step !== 0) {
              e.preventDefault();
              setLife((l) => l + step);
            } else if (e.key === 'Enter' && NO_MODIFIERS(e)) {
              e.preventDefault();
              openLifePrompt();
            }
          }}
          // Arrow target for right-click-drag arrows aimed at a player's
          // life total. The interactions hook hit-tests by looking for
          // `[data-arrow-target-kind="player"]` under the pointer; the
          // overlay resolves player-targeted committed arrows the same
          // way. Both self and opponent pills carry these — you can
          // point arrows at yourself in Cockatrice too.
          data-arrow-target-kind="player"
          data-arrow-target-player-id={playerId}
          onClick={isSelf ? () => setLife((l) => l + 1) : undefined}
          onContextMenu={
            isSelf
              ? (e) => {
                e.preventDefault();
                setLife((l) => l - 1);
              }
              : undefined
          }
          className={[
            'relative flex flex-col rounded-md overflow-hidden',
            isSelf ? GAME_FOCUS_RING : '',
            isSelf ? 'cursor-pointer select-none' : '',
          ].join(' ')}
          onMouseEnter={commander && !seat.avatarUrl ? () => setHoveredCard(commander) : undefined}
          style={{
            backgroundImage: backdrop ? `url(${backdrop})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: `${LIFE_TILE_EM}em`,
          }}
        >
          {!backdrop && (
            <>
              <div
                className="absolute inset-0 bg-gradient-to-br from-accent-secondary to-accent pointer-events-none"
                aria-hidden
              />
              {/* Wash only over the purple fallback — keeps no-avatar
              pills at a consistent darker tone. Avatars stay
              unfiltered so the user's picture reads clearly. */}
              <div
                className="absolute inset-0 bg-over-art-backdrop/50 pointer-events-none"
                aria-hidden
              />
            </>
          )}
          {/* Name row — pinned to the top. Stacked text-shadows (soft
          halo + tight outline) give the name a dark drop shadow
          that stays readable against any avatar color without
          needing a wash over the image. */}
          <div className="relative z-10 px-[0.5em] pt-[0.35em] pointer-events-none">
            <span
              className="block text-[0.875em] font-semibold text-over-art-text truncate"
              style={{ textShadow: OVER_ART_SHADOW_NAME }}
            >
              {name}
            </span>
          </div>
          {/* Life row — centered in the remaining space. The Heart is
          an SVG so we use `filter: drop-shadow(...)` for its
          shadow (text-shadow only affects glyphs). */}
          <div className="relative z-10 flex-1 flex items-center justify-start gap-[0.75em] px-[0.5em] pb-[0.25em] pointer-events-none">
            <Heart
              size="2.5em"
              className="text-over-art-life"
              style={{ filter: OVER_ART_ICON_SHADOW }}
              aria-hidden
            />
            <span
              className="text-[3em] font-modern font-bold tabular-nums text-over-art-text leading-none"
              style={{ textShadow: OVER_ART_SHADOW_LIFE }}
            >
              {life}
            </span>
          </div>
          {commander && (
            <span
              className="relative z-10 block truncate px-[0.5em] pb-[0.3em] text-[0.7em] font-medium text-over-art-text"
              style={{ textShadow: OVER_ART_SHADOW_NAME }}
              title={t('PlayerInfoPanel.commander', { name: commander.name })}
            >
              {t('PlayerInfoPanel.commander', { name: commander.name })}
            </span>
          )}
          <ValueFlashOverlay flash={lifeFlash} kind="change" />
        </div>
        <PlayerMenuButton />
      </div>


      <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={INFO_STACK_STYLE}>
        <div
          role="group"
          aria-label={t('PlayerInfoPanel.manaPool')}
          className="flex shrink-0 flex-wrap justify-center"
          style={MANA_GRID_STYLE}
          onKeyDown={(e) => {
            if (!isSelf || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) {
              return;
            }
            e.preventDefault();
            const next = (manaFocus + (e.key === 'ArrowRight' ? 1 : -1) + MANA_COLORS.length) % MANA_COLORS.length;
            setManaFocus(next);
            e.currentTarget.querySelectorAll<HTMLElement>('[role="spinbutton"]')[next]?.focus();
          }}
        >
          {MANA_COLORS.map((m, i) => {
            const counter = manaCounters?.[m.symbol];
            const canModify =
            isSelf && counter != null;
            const pip = (
              <ManaPip
                symbol={m.symbol}
                label={t(`PlayerInfoPanel.mana.${m.symbol}`)}
                tabIndex={i === manaFocus ? 0 : -1}
                onFocus={() => setManaFocus(i)}
                tint={m.tint}
                count={manaPool[m.symbol]}
                onIncrement={
                  canModify
                    ? () => counterCommands.increment(counter.id, 1)
                    : undefined
                }
                onDecrement={
                  canModify
                    ? () => counterCommands.increment(counter.id, -1)
                    : undefined
                }
              />
            );
            return <div key={m.symbol} style={MANA_PIP_SLOT_STYLE}>{pip}</div>;
          })}
        </div>
        <ZoneStack />
      </div>
    </div>
  );
}
