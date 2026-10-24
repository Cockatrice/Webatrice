import { Fragment, useEffect, useId, useRef, type CSSProperties, type WheelEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, Eye, FileText, Film, Flag, Home as HomeIcon, Keyboard, Library, MessageSquare, Settings as SettingsIcon,
  ShieldCheck, Swords, UserCircle2, X, type LucideIcon,
} from 'lucide-react';

import UnreadBadge from './UnreadBadge';
import { useScrollFades, type ScrollFades } from './hooks/useScrollFades';
import { tabTitle, type StripGroup, type StripGroupKey, type Tab, type TabType } from './topBarTabs';

const TYPE_ICON: Record<TabType, LucideIcon> = {
  server: HomeIcon,
  room: MessageSquare,
  game: Swords,
  decks: Library,
  deck: BookOpen,
  'my-decks': Library,
  settings: SettingsIcon,
  shortcuts: Keyboard,
  account: UserCircle2,
  logs: FileText,
  player: UserCircle2,
  staff: ShieldCheck,
  replays: Film,
  replay: Film,
  'my-reports': Flag,
  unknown: FileText,
};

const STRIP_GROUP_KEYS: Record<StripGroupKey, string> = {
  rooms: 'TopBar.group.rooms',
  games: 'TopBar.group.games',
  decks: 'TopBar.group.decks',
  replays: 'TopBar.group.replays',
  pages: 'TopBar.group.pages',
};

const FADE = 24;

function fadeMask({ start, end }: ScrollFades): CSSProperties | undefined {
  if (!start && !end) {
    return undefined;
  }
  const from = start ? `transparent, black ${FADE}px` : 'black';
  const to = end ? `black calc(100% - ${FADE}px), transparent` : 'black';
  const mask = `linear-gradient(to right, ${from}, ${to})`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

function TabIcon({ tab, active }: { tab: Tab; active: boolean }) {
  const tone = `shrink-0 ${active ? 'text-accent' : 'text-text-muted'}`;
  if (tab.spectating) {
    return <Eye size={14} aria-hidden className={tone} />;
  }
  const Icon = TYPE_ICON[tab.type];
  return <Icon size={14} aria-hidden className={tone} />;
}

export interface TabListProps {
  groups: StripGroup[];
  activeKey: string;
  onClose: (tab: Tab) => void;
  unreadOf?: (tab: Tab) => number;
  onLastClosed?: () => void;
}

export default function TabList({ groups, activeKey, onClose, unreadOf = () => 0, onLastClosed }: TabListProps) {
  const { t } = useTranslation();
  const id = useId();
  const links = useRef(new Map<string, HTMLAnchorElement>());
  const { ref: scrollerRef, fades } = useScrollFades<HTMLDivElement>();
  const tabs = groups.flatMap((group) => group.tabs);

  useEffect(() => {
    links.current.get(activeKey)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeKey]);

  const closeTab = (tab: Tab) => {
    const index = tabs.indexOf(tab);
    const successor = tabs[index + 1] ?? tabs[index - 1];
    if (successor) {
      links.current.get(successor.key)?.focus();
    } else {
      onLastClosed?.();
    }
    onClose(tab);
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.currentTarget.scrollLeft += event.deltaY;
    }
  };

  return (
    <nav aria-label={t('TopBar.tabs.label')} className="flex min-w-0 flex-1 self-stretch">
      <div
        ref={scrollerRef}
        onWheel={onWheel}
        style={fadeMask(fades)}
        className="flex min-w-0 flex-1 scroll-px-6 items-center gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]"
      >
        {groups.map((group, index) => {
          const labelId = `${id}-${group.key}`;
          return (
            <Fragment key={group.key}>
              {index > 0 && <span aria-hidden className="h-5 w-px shrink-0 bg-border-subtle" />}
              <span
                id={labelId}
                className="shrink-0 pl-1 pr-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted"
              >
                {t(STRIP_GROUP_KEYS[group.key])}
              </span>
              <ul role="list" aria-labelledby={labelId} className="contents">
                {group.tabs.map((tab) => {
                  const active = tab.key === activeKey;
                  const title = tabTitle(tab, t);
                  return (
                    <li
                      key={tab.key}
                      onAuxClick={(e) => {
                        if (e.button === 1 && tab.closeable) {
                          e.preventDefault();
                          onClose(tab);
                        }
                      }}
                      style={{ flex: '0 1 170px' }}
                      className={[
                        'group relative flex h-8 min-w-[120px] max-w-[200px] select-none items-center rounded-ui-sm border text-[13px]',
                        'transition-colors',
                        active
                          ? 'border-border-strong bg-bg-elevated text-text-primary shadow-sm'
                          : 'border-transparent text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary',
                      ].join(' ')}
                    >
                      <Link
                        ref={(element) => {
                          if (element) {
                            links.current.set(tab.key, element);
                          } else {
                            links.current.delete(tab.key);
                          }
                        }}
                        to={tab.route}
                        title={title}
                        aria-current={active ? 'page' : undefined}
                        className={[
                          'flex h-full min-w-0 flex-1 items-center gap-2 rounded-ui-sm pl-2.5 pr-1',
                          'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                        ].join(' ')}
                      >
                        <TabIcon tab={tab} active={active} />
                        <span className="min-w-0 flex-1 truncate text-left">{title}</span>
                        {tab.spectating && <>{' '}<span className="sr-only">{t('TopBar.tabs.spectating')}</span></>}
                        <UnreadBadge count={unreadOf(tab)} />
                      </Link>
                      {tab.closeable && (
                        <button
                          type="button"
                          onClick={() => closeTab(tab)}
                          className={[
                            'mr-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-ui-sm text-text-muted',
                            'hover:bg-bg-base/60 hover:text-text-primary',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                          ].join(' ')}
                          title={t('TopBar.tabs.close', { title })}
                          aria-label={t('TopBar.tabs.close', { title })}
                        >
                          <X size={12} aria-hidden />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}
