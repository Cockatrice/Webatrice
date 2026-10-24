import { useCallback, useEffect, useMemo, useState } from 'react';

import { cardDatabaseService, type Set } from '@app/services';

import { toCardDataError, type CardDataError } from './cardDataError';
import {
  buildSetRows,
  filterSetRows,
  moveSetRows,
  restoreDefaultOrder,
  rowsToPreferences,
  setEnabled,
  sortSetRows,
  type MoveDirection,
  type SetRow,
  type SetSortColumn,
} from './manageSetsModel';

export interface SetSort {
  column: SetSortColumn;
  ascending: boolean;
}

export interface SelectModifiers {
  toggle?: boolean;
  range?: boolean;
}

export interface ManageSets {
  loading: boolean;
  saving: boolean;
  error: CardDataError | null;
  dirty: boolean;
  rows: SetRow[];
  visibleRows: SetRow[];
  selected: ReadonlySet<string>;
  search: string;
  sort: SetSort | null;
  setSearch: (search: string) => void;
  select: (code: string, modifiers?: SelectModifiers) => void;
  selectAll: () => void;
  toggleEnabled: (code: string) => void;
  enableAll: (enabled: boolean) => void;
  enableSelected: (enabled: boolean) => void;
  move: (direction: MoveDirection) => void;
  restoreDefault: () => void;
  cycleSort: (column: SetSortColumn) => void;
  applySortAsPriority: () => void;
  save: () => Promise<boolean>;
  discard: () => void;
}

export function useManageSets(): ManageSets {
  const [sets, setSets] = useState<Set[]>([]);
  const [saved, setSaved] = useState<SetRow[]>([]);
  const [rows, setRows] = useState<SetRow[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new globalThis.Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SetSort | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<CardDataError | null>(null);

  useEffect(() => {
    let cancelled = false;
    cardDatabaseService.getSetInventory().then(({ sets: loaded, preferences }) => {
      if (cancelled) {
        return;
      }
      const built = buildSetRows(loaded, new Map(preferences.map((p) => [p.code, p])));
      setSets(loaded);
      setSaved(built);
      setRows(built);
      setLoading(false);
    }).catch((e: Error) => {
      if (!cancelled) {
        setError(toCardDataError('load', e));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRows = useMemo(() => {
    const filtered = filterSetRows(rows, search);
    return sort ? sortSetRows(filtered, sort.column, sort.ascending) : filtered;
  }, [rows, search, sort]);

  const select = useCallback((code: string, { toggle, range }: SelectModifiers = {}) => {
    setSelected((current) => {
      if (range && anchor) {
        const codes = visibleRows.map((r) => r.code);
        const [from, to] = [codes.indexOf(anchor), codes.indexOf(code)].sort((a, b) => a - b);
        if (from >= 0) {
          return new globalThis.Set(codes.slice(from, to + 1));
        }
      }
      if (toggle) {
        const next = new globalThis.Set(current);
        if (next.has(code)) {
          next.delete(code);
        } else {
          next.add(code);
        }
        return next;
      }
      return new globalThis.Set([code]);
    });
    if (!range) {
      setAnchor(code);
    }
  }, [anchor, visibleRows]);

  const selectAll = useCallback(() => {
    setSelected(new globalThis.Set(visibleRows.map((r) => r.code)));
  }, [visibleRows]);

  const toggleEnabled = useCallback((code: string) => {
    setRows((current) => current.map((r) => (r.code === code ? { ...r, enabled: !r.enabled } : r)));
  }, []);

  const move = (direction: MoveDirection) => {
    if (sort) {
      return;
    }
    setRows((current) => moveSetRows(current, visibleRows.map((r) => r.code), selected, direction));
  };

  const cycleSort = (column: SetSortColumn) => {
    setSort((current) => {
      if (!current || current.column !== column) {
        return { column, ascending: true };
      }
      return current.ascending ? { column, ascending: false } : null;
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await cardDatabaseService.saveSetPreferences(rowsToPreferences(rows));
      setSaved(rows);
      return true;
    } catch (e) {
      setError(toCardDataError('save', e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    loading,
    saving,
    error,
    dirty: rows !== saved,
    rows,
    visibleRows,
    selected,
    search,
    sort,
    setSearch,
    select,
    selectAll,
    toggleEnabled,
    enableAll: (enabled) => setRows((current) => setEnabled(current, 'all', enabled)),
    enableSelected: (enabled) => setRows((current) => setEnabled(current, selected, enabled)),
    move,
    restoreDefault: () => {
      setSort(null);
      setRows((current) => restoreDefaultOrder(current, sets));
    },
    cycleSort,
    applySortAsPriority: () => {
      if (sort) {
        setRows((current) => sortSetRows(current, sort.column, sort.ascending));
        setSort(null);
      }
    },
    save,
    discard: () => {
      setRows(saved);
      setSort(null);
    },
  };
}
