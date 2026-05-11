import { useTranslation } from 'react-i18next';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import EditIcon from '@mui/icons-material/Edit';
import RestoreIcon from '@mui/icons-material/Restore';
import WarningIcon from '@mui/icons-material/Warning';

import { ShortcutsDispatch, ShortcutsSelectors, useAppSelector } from '@app/store';

import { displaySequence } from '../shortcutSequence';
import { ActionId } from '../types';
import { useResolvedBinding } from '../useResolvedBinding';

interface ShortcutsRowProps {
  actionId: ActionId;
  conflicts: ActionId[];
  onEdit: () => void;
}

const ShortcutsRow = ({ actionId, conflicts, onEdit }: ShortcutsRowProps) => {
  const { t } = useTranslation();
  const sequences = useResolvedBinding(actionId);
  const isOverridden = useAppSelector((s) => ShortcutsSelectors.isOverridden(s, actionId));
  const hasConflict = conflicts.length > 0;

  return (
    <div className="ShortcutsRow">
      <div className="ShortcutsRow__name">
        <span>{t(`ShortcutsTab.action.${actionId}`)}</span>
        {hasConflict && (
          <Tooltip
            title={t('ShortcutsTab.conflictWarning', {
              actions: conflicts.map((id) => t(`ShortcutsTab.action.${id}`)).join(', '),
            })}
          >
            <WarningIcon color="warning" fontSize="small" />
          </Tooltip>
        )}
      </div>
      <div className="ShortcutsRow__chips">
        {sequences.length === 0 ? (
          <span className="ShortcutsRow__noBinding">{t('ShortcutsTab.noBinding')}</span>
        ) : (
          sequences.map((seq) => (
            <Chip
              key={seq}
              label={displaySequence(seq)}
              size="small"
              color={hasConflict ? 'warning' : 'default'}
              variant={hasConflict ? 'filled' : 'outlined'}
            />
          ))
        )}
      </div>
      <div className="ShortcutsRow__actions">
        <Tooltip title={t('ShortcutsTab.edit')}>
          <IconButton size="small" onClick={onEdit} aria-label={t('ShortcutsTab.edit')}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('ShortcutsTab.resetAction')}>
          <span>
            <IconButton
              size="small"
              onClick={() => ShortcutsDispatch.resetAction(actionId)}
              disabled={!isOverridden}
              aria-label={t('ShortcutsTab.resetAction')}
            >
              <RestoreIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </div>
    </div>
  );
};

export default ShortcutsRow;
