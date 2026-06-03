import { memo } from 'react';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import { useGameDialogsContext } from '../../ui/GameDialogsContext';

import './PlayerContextMenu.css';

// Self-sources its open state (playerMenu) and the create-token / view-sideboard
// openers from GameDialogsContext, so Game renders it propless.
function PlayerContextMenu() {
  const { playerMenu, closePlayerMenu, openCreateToken, openSideboard } = useGameDialogsContext();
  const isOpen = playerMenu != null;

  const handleCreateToken = () => {
    openCreateToken();
    closePlayerMenu();
  };

  const handleViewSideboard = () => {
    openSideboard();
    closePlayerMenu();
  };

  return (
    <Menu
      open={isOpen}
      onClose={closePlayerMenu}
      anchorReference="anchorPosition"
      anchorPosition={playerMenu ?? undefined}
      data-testid="player-context-menu"
      className="player-context-menu"
    >
      <MenuItem onClick={handleCreateToken}>Create token…</MenuItem>
      <Divider />
      <MenuItem onClick={handleViewSideboard}>View sideboard…</MenuItem>
    </Menu>
  );
}

export default memo(PlayerContextMenu);
