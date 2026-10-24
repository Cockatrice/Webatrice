import { NavLink, generatePath } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Images } from '@app/images';
import { ServerInfo_User } from '@cockatrice/sockatrice/generated';
import { RouteEnum } from '@app/types';
import { UserBadges } from '../UserBadges/UserBadges';
import UserActionsMenu from './UserActionsMenu';
import { useUserDisplay } from './useUserDisplay';

import './UserDisplay.css';

interface UserDisplayProps {
  user: ServerInfo_User;
}

const UserDisplay = ({ user }: UserDisplayProps) => {
  const { t } = useTranslation();
  const { name, country, userLevel } = user;
  const {
    menu,
    isABuddy,
    isIgnored,
    onAddBuddy,
    onRemoveBuddy,
    onAddIgnore,
    onRemoveIgnore,
  } = useUserDisplay(name);

  return (
    <div className="user-display">
      <NavLink to={generatePath(RouteEnum.PLAYER, { name })} className="plain-link" {...menu.getTriggerProps()}>
        <div className="user-display__details">
          <img
            className="user-display__country"
            src={Images.Countries[country]}
            alt={country ? t(`Common.countries.${country.toUpperCase()}`, { defaultValue: country }) : ''}
          />
          <div className="user-display__name single-line-ellipsis">{name}</div>
          <UserBadges userLevel={userLevel} size={12} className="ml-1" />
        </div>
      </NavLink>
      {menu.anchor && (
        <UserActionsMenu
          anchor={menu.anchor}
          triggerRef={menu.triggerRef}
          onClose={menu.close}
          name={name}
          userLevel={userLevel}
          isABuddy={isABuddy}
          isIgnored={isIgnored}
          onAddBuddy={onAddBuddy}
          onRemoveBuddy={onRemoveBuddy}
          onAddIgnore={onAddIgnore}
          onRemoveIgnore={onRemoveIgnore}
        />
      )}
    </div>
  );
};

export default UserDisplay;
