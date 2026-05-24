import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { shortcuts, useAppSelector } from '@app/store';

import { allActionIds, defaults } from '../defaults';
import { ActionId, ShortcutGroupId, ShortcutScope } from '../types';
import SequenceEdit from './SequenceEdit';
import ShortcutsRow from './ShortcutsRow';

import './ShortcutsTab.css';

// Display order; matches Cockatrice's group ordering pattern (Global → Game → Editor).
const GROUP_ORDER: ShortcutGroupId[] = [
  'global',
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

  return (
    <Paper>
      <div className="ShortcutsTab__header">
        <Typography variant="h6">{t('ShortcutsTab.title')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('ShortcutsTab.description')}
        </Typography>
      </div>
      <div className="ShortcutsTab__search">
        <TextField
          fullWidth
          size="small"
          label={t('ShortcutsTab.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!hasResults ? (
        <div className="ShortcutsTab__noResults">{t('ShortcutsTab.noResults')}</div>
      ) : (
        GROUP_ORDER.map((groupId) => {
          const ids = filteredGroups[groupId];
          if (ids.length === 0) {
            return null;
          }
          return (
            <Accordion key={groupId} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{t(`ShortcutsTab.group.${groupId}`)}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {ids.map((id) => (
                  <ShortcutsRow
                    key={id}
                    actionId={id}
                    conflicts={conflictsByAction.get(id) ?? []}
                    onEdit={() => setEditingActionId(id)}
                  />
                ))}
              </AccordionDetails>
            </Accordion>
          );
        })
      )}

      {editingActionId && (
        <SequenceEdit actionId={editingActionId} onClose={() => setEditingActionId(null)} />
      )}
    </Paper>
  );
};

export default ShortcutsTab;
