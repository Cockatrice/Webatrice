import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Folder, FolderOpen, FolderPlus, Globe, HardDrive, Link2, Plus } from 'lucide-react';

import { Button, IconButton, SectionLabel } from '@app/components';
import { cx } from '@app/utils';

import type { DeckFolderNode } from '../../deckFolders';
import { ImportMenuButton } from './ImportMenuButton';

export interface DeckStorageSidebarProps {
  loading: boolean;
  deckTotal: number;
  folders: DeckFolderNode[];
  activePath: string;
  isConnected: boolean;
  onSelect: (path: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onMigrate: () => void;
  onNewFolder: () => void;
  publicDeckCount?: number;
  onPublicDecks?: () => void;
  onShareLinks?: () => void;
  onOpenShareLink?: () => void;
}

function TreeButton({ icon, label, count, active, depth = 0, expanded, onToggle, onClick }: {
  icon: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  depth?: number;
  expanded?: boolean;
  onToggle?: () => void;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center" style={{ paddingLeft: depth * 16 }}>
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={t(expanded ? 'DeckStorageSidebar.collapse' : 'DeckStorageSidebar.expand', { name: label })}
          aria-expanded={expanded}
          className={cx(
            'inline-flex h-7 w-5 shrink-0 items-center justify-center rounded-ui-sm text-text-muted hover:text-text-primary',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
          )}
        >
          <ChevronDown size={13} className={cx('transition-transform', !expanded && '-rotate-90')} />
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={cx(
          'flex h-[calc(var(--row-h)-6px)] min-w-0 flex-1 items-center gap-2 rounded-ui-sm px-2 text-left text-[13px]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
          active ? 'bg-accent/15 font-medium text-accent' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
        )}
      >
        <span className={cx('shrink-0', active ? 'text-accent' : 'text-text-muted')}>{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {count !== undefined && <span className="text-[12px] tabular-nums text-text-muted">{count}</span>}
      </button>
    </div>
  );
}

function FolderBranch({ node, depth, activePath, onSelect }: {
  node: DeckFolderNode;
  depth: number;
  activePath: string;
  onSelect: (path: string) => void;
}) {
  const containsActive = activePath === node.path || activePath.startsWith(`${node.path}/`);
  const [expanded, setExpanded] = useState(true);
  const open = expanded || containsActive;
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <TreeButton
        icon={<Folder size={14} />}
        label={node.name}
        count={node.deckCount}
        active={activePath === node.path}
        depth={depth}
        expanded={hasChildren ? open : undefined}
        onToggle={hasChildren && !containsActive ? () => setExpanded(!expanded) : undefined}
        onClick={() => onSelect(node.path)}
      />
      {hasChildren && open && (
        <ul className="flex flex-col gap-0.5 pt-0.5">
          {node.children.map((child) => (
            <FolderBranch key={child.path} node={child} depth={depth + 1} activePath={activePath} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function DeckStorageSidebar({
  loading, deckTotal, folders, activePath, isConnected, onSelect, onCreate, onImport, onMigrate, onNewFolder,
  publicDeckCount, onPublicDecks, onShareLinks, onOpenShareLink,
}: DeckStorageSidebarProps) {
  const { t } = useTranslation();
  const sharing = onPublicDecks || onShareLinks || onOpenShareLink;
  return (
    <aside className="flex min-h-0 w-[248px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border-subtle bg-bg-surface p-pad">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-display text-[20px] font-semibold text-text-primary">{t('Decks.list.title')}</h1>
        <span className="text-[12px] text-text-muted">
          {loading ? t('Common.status.loading') : t('DeckStorageSidebar.subtitle', { count: deckTotal })}
        </span>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1 !px-3" icon={<Plus size={15} />} onClick={onCreate} disabled={!isConnected}>
          {t('Decks.list.newDeck')}
        </Button>
        <ImportMenuButton className="flex-1 !px-3" onMigrate={onMigrate} onImport={onImport} isConnected={isConnected} />
      </div>
      <nav aria-label={t('DeckStorageSidebar.folders')} className="flex flex-col gap-1">
        <div className="flex items-center pb-1 pl-2">
          <SectionLabel>{t('DeckStorageSidebar.folders')}</SectionLabel>
          <IconButton
            size="sm"
            label={t('DeckFolders.newFolder')}
            className="ml-auto !h-6 !w-6"
            onClick={onNewFolder}
            disabled={!isConnected || loading}
          >
            <FolderPlus size={14} />
          </IconButton>
        </div>
        <ul className="flex flex-col gap-0.5">
          <li>
            <TreeButton
              icon={<HardDrive size={14} />}
              label={t('DeckStorageSidebar.allDecks')}
              count={loading ? undefined : deckTotal}
              active={activePath === ''}
              onClick={() => onSelect('')}
            />
          </li>
          {folders.map((node) => (
            <FolderBranch key={node.path} node={node} depth={0} activePath={activePath} onSelect={onSelect} />
          ))}
        </ul>
      </nav>
      {sharing && (
        <nav aria-label={t('DeckStorageSidebar.sharing')} className="flex flex-col gap-1 border-t border-border-subtle pt-3">
          <SectionLabel className="pb-1 pl-2">{t('DeckStorageSidebar.sharing')}</SectionLabel>
          <ul className="flex flex-col gap-0.5">
            {onPublicDecks && (
              <li>
                <TreeButton icon={<Globe size={14} />} label={t('DeckStorageSidebar.publicDecks')} count={publicDeckCount}
                  onClick={onPublicDecks} />
              </li>
            )}
            {onShareLinks && (
              <li>
                <TreeButton icon={<Link2 size={14} />} label={t('DeckShareLinks.open')} onClick={onShareLinks} />
              </li>
            )}
            {onOpenShareLink && (
              <li>
                <TreeButton icon={<FolderOpen size={14} />} label={t('OpenShareLink.open')} onClick={onOpenShareLink} />
              </li>
            )}
          </ul>
        </nav>
      )}
    </aside>
  );
}
