import { useTranslation } from 'react-i18next';
import { AlertTriangle, Pencil, RotateCcw } from 'lucide-react';

import { shortcuts, useAppDispatch, useAppSelector } from '@app/store';

import { ActionId } from '../types';
import { useResolvedBinding } from '../useResolvedBinding';
import { KeycapSequence } from './Keycap';

interface ShortcutsRowProps {
  actionId: ActionId;
  conflicts: ActionId[];
  onEdit: () => void;
}

const ShortcutsRow = ({ actionId, conflicts, onEdit }: ShortcutsRowProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const sequences = useResolvedBinding(actionId);
  const isOverridden = useAppSelector((s) => shortcuts.Selectors.isOverridden(s, actionId));
  const hasConflict = conflicts.length > 0;

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 border-b border-border-subtle last:border-b-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-text-primary truncate">
          {t(`ShortcutsTab.action.${actionId}`)}
        </span>
        {hasConflict && (
          <span
            className="text-amber-400 shrink-0"
            title={t('ShortcutsTab.conflictWarning', {
              actions: conflicts.map((id) => t(`ShortcutsTab.action.${id}`)).join(', '),
            })}
          >
            <AlertTriangle size={14} />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 items-end">
        {sequences.length === 0 ? (
          <span className="italic text-xs text-text-muted">
            {t('ShortcutsTab.noBinding')}
          </span>
        ) : (
          sequences.map((seq) => (
            <KeycapSequence
              key={seq}
              sequence={seq}
              tone={hasConflict ? 'warning' : 'neutral'}
            />
          ))
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('ShortcutsTab.edit')}
          title={t('ShortcutsTab.edit')}
          className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={() => dispatch(shortcuts.Actions.resetAction({ actionId }))}
          disabled={!isOverridden}
          aria-label={t('ShortcutsTab.resetAction')}
          title={t('ShortcutsTab.resetAction')}
          className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
};

export default ShortcutsRow;
