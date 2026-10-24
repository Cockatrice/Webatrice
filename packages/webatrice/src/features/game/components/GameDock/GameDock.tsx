import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Flag, Info, Layers, LogOut, MessageSquare, PanelRightClose, PanelRightOpen, Users, type LucideIcon } from 'lucide-react';

import { games } from '@cockatrice/datatrice';
import { Button, IconButton } from '@app/components';
import { useAppSelector } from '@app/store';
import { cx } from '@app/utils';

import PlayerList from '../right-sidebar/PlayerList/PlayerList';
import ChatLog from '../ChatLog/ChatLog';
import CardPreviewPane from '../CardPreviewPane/CardPreviewPane';
import GameInviteControls from '../GameInviteControls/GameInviteControls';
import GameMenu from '../GameMenu/GameMenu';
import { useGameId } from '../ui/GameIdContext';
import { useGameDialogActions } from '../ui/GameDialogActionsContext';
import { useGameReadOnly } from '../ui/GameReadOnlyContext';
import { useLocalIdentity } from '../../hooks/useLocalIdentity';
import { useGameAffordances } from '../../hooks/useGameAffordances';
import { useElementWidth } from '../../hooks/useElementWidth';
import type { DockTab } from '../../hooks/useDockState';
import { GAME_FOCUS_RING } from '../ui/focusRing';

const TABS: ReadonlyArray<{ id: DockTab; Icon: LucideIcon }> = [
  { id: 'log', Icon: MessageSquare },
  { id: 'players', Icon: Users },
  { id: 'spectators', Icon: Eye },
];

export const DOCK_COMPACT_TABS_BELOW_PX = 340;

const MENU_BUTTON_CLASS = cx(
  'inline-flex h-7 items-center gap-1.5 rounded-ui border border-border-strong px-2.5 text-[12px] font-medium text-text-primary',
  'hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-45 board-motion transition-colors',
  GAME_FOCUS_RING,
);

export interface GameDockProps {
  collapsed: boolean;
  tab: DockTab;
  onCollapse: (collapsed: boolean) => void;
  onSelectTab: (tab: DockTab) => void;
}

export default function GameDock({ collapsed, tab, onCollapse, onSelectTab }: GameDockProps) {
  const { t } = useTranslation();
  const gameId = useGameId();
  const { isSpectator } = useLocalIdentity();
  const readOnly = useGameReadOnly();
  const { onRequestConcede, onRequestUnconcede, onRequestGameInfo, onRequestViewSideboard, onRequestLeave } = useGameDialogActions();
  const { canConcede, canUnconcede } = useGameAffordances(gameId ?? undefined);
  const players = useAppSelector((state) => (gameId != null ? games.Selectors.getPlayers(state, gameId) : undefined));
  const entries = players ? Object.values(players) : [];
  const counts: Record<DockTab, number> = {
    log: 0,
    players: entries.filter((p) => !p.properties.spectator).length,
    spectators: entries.filter((p) => p.properties.spectator).length,
  };
  const baseId = useId();
  const tabId = (id: DockTab) => `${baseId}-tab-${id}`;
  const panelId = (id: DockTab) => `${baseId}-panel-${id}`;
  const asideRef = useRef<HTMLElement | null>(null);
  const width = useElementWidth(asideRef);
  const compact = !collapsed && width > 0 && width < DOCK_COMPACT_TABS_BELOW_PX;

  const focusTabOnExpand = useRef(false);
  useEffect(() => {
    if (!collapsed && focusTabOnExpand.current) {
      asideRef.current?.querySelector<HTMLElement>(`[data-dock-tab="${tab}"]`)?.focus();
    }
    focusTabOnExpand.current = false;
  }, [collapsed, tab]);
  const expand = () => {
    focusTabOnExpand.current = true;
    onCollapse(false);
  };

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (delta === 0) {
      return;
    }
    e.preventDefault();
    const next = TABS[(index + delta + TABS.length) % TABS.length].id;
    onSelectTab(next);
    (e.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-dock-tab="${next}"]`))?.focus();
  };

  const tabLabel = (id: DockTab) => (counts[id] > 0 ? `${t(`GameDock.tab.${id}`)} (${counts[id]})` : t(`GameDock.tab.${id}`));

  const spectatingTag = isSpectator && (
    <div
      data-testid="spectating-tag"
      className={cx(
        'shrink-0 border-b border-warning/30 bg-warning/10 px-2 py-1 text-center text-[10px] font-semibold uppercase',
        'tracking-widest text-warning',
        collapsed && '[writing-mode:vertical-rl]',
      )}
    >
      {readOnly ? t('GameReplay.sidebar.tag') : t('GameDock.spectating')}
    </div>
  );

  const panel = (id: DockTab, children: React.ReactNode) => {
    const shown = !collapsed && tab === id;
    return (
      <div
        key={id}
        id={panelId(id)}
        role="tabpanel"
        aria-labelledby={tabId(id)}
        hidden={!shown}
        className={cx('min-h-0 flex-1 flex-col', shown && 'flex')}
      >
        {children}
      </div>
    );
  };

  const panelContent: Record<DockTab, React.ReactNode> = {
    log: <ChatLog onReveal={() => onSelectTab('log')} visible={!collapsed && tab === 'log'} />,
    players: (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 px-3 py-2">
          <h2 className="mr-auto text-[10px] font-semibold uppercase tracking-widest text-text-muted">{t('GameDock.players')}</h2>
          {!readOnly && gameId != null && <GameInviteControls gameId={gameId} />}
          {!readOnly && <GameMenu className={MENU_BUTTON_CLASS} />}
        </div>
        <PlayerList kind="players" />
      </div>
    ),
    spectators: (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <h2 className="shrink-0 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          {t('GameDock.tab.spectators')}
        </h2>
        <PlayerList kind="spectators" />
      </div>
    ),
  };
  const panels = TABS.map(({ id }) => panel(id, panelContent[id]));

  const rail = (
    <div className="flex shrink-0 flex-col items-center gap-1 py-1.5">
      <IconButton size="sm" className="board-motion" label={t('GameDock.expand')} onClick={expand}>
        <PanelRightOpen size={15} />
      </IconButton>
      {TABS.map(({ id, Icon }) => (
        <IconButton
          key={id}
          size="sm"
          label={tabLabel(id)}
          onClick={() => onSelectTab(id)}
          className="relative board-motion"
        >
          <Icon size={15} />
          {counts[id] > 0 && (
            <span
              className={cx(
                'absolute -right-0.5 -top-0.5 rounded-full bg-bg-elevated px-1 text-[9px] font-semibold leading-[14px]',
                'text-text-muted',
              )}
              aria-hidden
            >
              {counts[id]}
            </span>
          )}
        </IconButton>
      ))}
      {spectatingTag}
    </div>
  );

  const tablist = (
    <div className="flex shrink-0 flex-col">
      {spectatingTag}
      <div
        role="tablist"
        aria-label={t('GameDock.tabs')}
        className="flex h-11 shrink-0 items-center gap-1 border-b border-border-subtle px-1.5"
      >
        {TABS.map(({ id, Icon }, index) => {
          const on = tab === id;
          return (
            <button
              key={id}
              id={tabId(id)}
              type="button"
              role="tab"
              data-dock-tab={id}
              aria-selected={on}
              aria-controls={panelId(id)}
              tabIndex={on ? 0 : -1}
              title={compact ? tabLabel(id) : undefined}
              onClick={() => onSelectTab(id)}
              onKeyDown={(e) => onTabKeyDown(e, index)}
              className={cx(
                'flex h-8 items-center gap-1.5 whitespace-nowrap rounded-ui-sm px-2 text-[12.5px] font-medium',
                'board-motion transition-colors',
                on ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-elevated/60',
                GAME_FOCUS_RING,
              )}
            >
              {compact && <Icon size={15} aria-hidden />}
              <span className={cx(compact && 'sr-only')}>{t(`GameDock.tab.${id}`)}</span>
              {counts[id] > 0 && (
                <span
                  className={cx(
                    'rounded-full px-1.5 text-[10px] font-semibold',
                    on ? 'bg-accent text-on-accent' : 'bg-bg-elevated text-text-muted',
                  )}
                >
                  {counts[id]}
                </span>
              )}
            </button>
          );
        })}
        <IconButton size="sm" label={t('GameDock.collapse')} className="ml-auto board-motion" onClick={() => onCollapse(true)}>
          <PanelRightClose size={15} />
        </IconButton>
      </div>
    </div>
  );

  return (
    <aside
      ref={asideRef}
      data-testid="right-panel"
      aria-label={t('GameDock.label')}
      className={cx(
        'flex h-full w-full min-h-0 flex-col border-l border-border-subtle bg-bg-surface',
        collapsed ? 'items-center' : 'overflow-hidden',
      )}
    >
      {collapsed ? rail : (
        <>
          <CardPreviewPane />
          {tablist}
        </>
      )}

      {panels}

      <div hidden={collapsed} className={cx('shrink-0 grid-cols-2 gap-1.5 border-t border-border-subtle p-2', !collapsed && 'grid')}>
        {canConcede && (
          <Button
            size="sm"
            className="board-motion"
            icon={<Flag size={13} />}
            onClick={onRequestConcede}
            title={t('GameDock.concedeTitle')}
          >
            {t('GameDock.concede')}
          </Button>
        )}
        {canUnconcede && (
          <Button
            size="sm"
            className="board-motion"
            icon={<Flag size={13} />}
            onClick={onRequestUnconcede}
            title={t('GameDock.rejoinTitle')}
          >
            {t('GameDock.rejoin')}
          </Button>
        )}
        {!readOnly && !isSpectator && (
          <Button
            size="sm"
            className="board-motion"
            icon={<Layers size={13} />}
            onClick={onRequestViewSideboard}
            title={t('GameDock.sideboardTitle')}
          >
            {t('GameDock.sideboard')}
          </Button>
        )}
        {!readOnly && (
          <Button size="sm" className="board-motion" icon={<Info size={13} />} onClick={onRequestGameInfo} disabled={gameId == null}>
            {t('GameDock.gameInfo')}
          </Button>
        )}
        <Button
          size="sm"
          className="board-motion"
          icon={<LogOut size={13} />}
          onClick={onRequestLeave}
          disabled={gameId == null}
          title={readOnly ? t('GameReplay.sidebar.closeTitle') : t('GameDock.leaveTitle')}
        >
          {readOnly ? t('GameReplay.sidebar.close') : t('GameDock.leave')}
        </Button>
      </div>
    </aside>
  );
}
