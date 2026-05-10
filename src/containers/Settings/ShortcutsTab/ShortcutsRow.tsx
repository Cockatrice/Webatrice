import { useTranslation } from 'react-i18next';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import EditIcon from '@mui/icons-material/Edit';
import RestoreIcon from '@mui/icons-material/Restore';
import WarningIcon from '@mui/icons-material/Warning';

import { ActionId, useResolvedBinding } from '@app/features/shortcuts';
import { ShortcutsDispatch, ShortcutsSelectors, useAppSelector } from '@app/store';
import { displaySequence } from '@app/utils';

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
        <span>{t(`Settings.shortcuts.action.${actionId}`)}</span>
        {hasConflict && (
          <Tooltip
            title={t('Settings.shortcuts.conflictWarning', {
              actions: conflicts.map((id) => t(`Settings.shortcuts.action.${id}`)).join(', '),
            })}
          >
            <WarningIcon color="warning" fontSize="small" />
          </Tooltip>
        )}
      </div>
      <div className="ShortcutsRow__chips">
        {sequences.length === 0 ? (
          <span className="ShortcutsRow__noBinding">{t('Settings.shortcuts.noBinding')}</span>
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
        <Tooltip title={t('Settings.shortcuts.edit')}>
          <IconButton size="small" onClick={onEdit} aria-label={t('Settings.shortcuts.edit')}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('Settings.shortcuts.resetAction')}>
          <span>
            <IconButton
              size="small"
              onClick={() => ShortcutsDispatch.resetAction(actionId)}
              disabled={!isOverridden}
              aria-label={t('Settings.shortcuts.resetAction')}
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
