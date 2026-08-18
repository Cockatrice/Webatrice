import { NavLink, generatePath } from 'react-router-dom';

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
  const { name, country, userLevel } = user;
  const {
    position,
    isABuddy,
    isIgnored,
    handleClick,
    handleClose,
    onAddBuddy,
    onRemoveBuddy,
    onAddIgnore,
    onRemoveIgnore,
  } = useUserDisplay(name);

  return (
    <div className="user-display">
      <NavLink to={generatePath(RouteEnum.PLAYER, { name })} className="plain-link">
        <div className="user-display__details" onContextMenu={handleClick}>
          <img className="user-display__country" src={Images.Countries[country]} alt={country} />
          <div className="user-display__name single-line-ellipsis">{name}</div>
          <UserBadges userLevel={userLevel} size={12} className="ml-1" />
        </div>
      </NavLink>
      {position && (
        <UserActionsMenu
          x={position.x}
          y={position.y}
          onClose={handleClose}
          name={name}
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
