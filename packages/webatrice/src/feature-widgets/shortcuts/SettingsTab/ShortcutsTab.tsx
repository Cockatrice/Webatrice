import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

import { shortcuts, useAppSelector } from '@app/store';

import { allActionIds, defaults } from '../defaults';
import { ActionId, ShortcutGroupId, ShortcutScope } from '../types';
import SequenceEdit from './SequenceEdit';
import ShortcutsRow from './ShortcutsRow';

// Display order; matches Cockatrice's group ordering pattern (Game → Editor).
const GROUP_ORDER: ShortcutGroupId[] = [
  'game',
  'gamePhases',
  'deckEditor',
  'room',
];

const ShortcutsTab = () => {
  const { t } = useTranslation();
  const overrides = useAppSelector(shortcuts.Selectors.getOverrides);

  const [search, setSearch] = useState('');
  const [editingActionId, setEditingActionId] = useState<ActionId | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<ShortcutGroupId>>(new Set());

  // Static grouping; defaults map doesn't change at runtime.
  const grouped = useMemo(() => {
    const out = {} as Record<ShortcutGroupId, ActionId[]>;
    for (const groupId of GROUP_ORDER) {
      out[groupId] = [];
    }
    for (const id of allActionIds) {
      out[defaults[id].group].push(id);
    }
    return out;
  }, []);

  // Pairwise conflict map: two actions conflict when they share a sequence AND their scopes
  // overlap at runtime — same scope, or one of them is GLOBAL (always active).
  const conflictsByAction = useMemo(() => {
    const seqToActions = new Map<string, ActionId[]>();
    for (const id of allActionIds) {
      const seqs = overrides[id] ?? defaults[id].sequences;
      for (const seq of seqs) {
        const list = seqToActions.get(seq) ?? [];
        list.push(id);
        seqToActions.set(seq, list);
      }
    }
    const conflicts = new Map<ActionId, ActionId[]>();
    for (const ids of seqToActions.values()) {
      if (ids.length < 2) {
        continue;
      }
      for (const a of ids) {
        for (const b of ids) {
          if (a === b) {
            continue;
          }
          const scopesOverlap =
            defaults[a].scope === defaults[b].scope ||
            defaults[a].scope === ShortcutScope.GLOBAL ||
            defaults[b].scope === ShortcutScope.GLOBAL;
          if (!scopesOverlap) {
            continue;
          }
          const list = conflicts.get(a) ?? [];
          if (!list.includes(b)) {
            list.push(b);
          }
          conflicts.set(a, list);
        }
      }
    }
    return conflicts;
  }, [overrides]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return grouped;
    }
    const out = {} as Record<ShortcutGroupId, ActionId[]>;
    for (const groupId of GROUP_ORDER) {
      out[groupId] = grouped[groupId].filter((id) => {
        const label = t(`ShortcutsTab.action.${id}`).toLowerCase();
        return label.includes(term) || id.toLowerCase().includes(term);
      });
    }
    return out;
  }, [grouped, search, t]);

  const hasResults = GROUP_ORDER.some((g) => filteredGroups[g].length > 0);

  const toggleGroup = (groupId: ShortcutGroupId) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="font-modern text-xl font-semibold text-text-primary">
          {t('ShortcutsTab.title')}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {t('ShortcutsTab.description')}
        </p>
      </div>
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('ShortcutsTab.search')}
          aria-label={t('ShortcutsTab.search')}
          className={[
            'w-full bg-bg-base border border-border-subtle rounded-md',
            'px-3 py-2 text-sm text-text-primary placeholder:text-text-muted',
            'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
          ].join(' ')}
        />
      </div>

      {!hasResults ? (
        <div className="p-4 text-center text-sm text-text-muted">
          {t('ShortcutsTab.noResults')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {GROUP_ORDER.map((groupId) => {
            const ids = filteredGroups[groupId];
            if (ids.length === 0) {
              return null;
            }
            const collapsed = collapsedGroups.has(groupId);
            return (
              <section
                key={groupId}
                className="rounded-lg bg-bg-surface border border-border-subtle overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(groupId)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-bg-elevated transition-colors"
                  aria-expanded={!collapsed}
                >
                  <ChevronDown
                    size={16}
                    className={[
                      'text-text-muted transition-transform',
                      collapsed ? '-rotate-90' : '',
                    ].join(' ')}
                  />
                  <span className="text-sm font-semibold text-text-primary">
                    {t(`ShortcutsTab.group.${groupId}`)}
                  </span>
                  <span className="text-xs text-text-muted ml-auto">
                    {ids.length}
                  </span>
                </button>
                {!collapsed && (
                  <div className="border-t border-border-subtle">
                    {ids.map((id) => (
                      <ShortcutsRow
                        key={id}
                        actionId={id}
                        conflicts={conflictsByAction.get(id) ?? []}
                        onEdit={() => setEditingActionId(id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {editingActionId && (
        <SequenceEdit actionId={editingActionId} onClose={() => setEditingActionId(null)} />
      )}
    </div>
  );
};

export default ShortcutsTab;
