import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { MenuItem, MenuSeparator, type UserMenuSlotProps } from '@app/components';

import { MODERATION_MENU_LABEL_KEYS } from './moderationMenu';
import { useModerationMenu } from './useModerationMenu';

const ModerationMenuItems = ({ userName, userLevel, onClose }: UserMenuSlotProps) => {
  const { t } = useTranslation();
  const { groups, open } = useModerationMenu(userName, userLevel);

  return (
    <>
      {groups.map((group, index) => (
        <Fragment key={index}>
          <MenuSeparator />
          {group.map(({ action, disabled }) => (
            <MenuItem
              key={action}
              disabled={disabled}
              disabledReason={t('Moderation.menu.self')}
              onSelect={() => {
                open(action);
                onClose();
              }}
            >
              {t(MODERATION_MENU_LABEL_KEYS[action])}
            </MenuItem>
          ))}
        </Fragment>
      ))}
    </>
  );
};

export default ModerationMenuItems;
