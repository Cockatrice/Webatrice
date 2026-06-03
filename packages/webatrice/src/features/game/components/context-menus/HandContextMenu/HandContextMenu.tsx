import { ZoneName } from '@cockatrice/sockatrice';
import { memo } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';

import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import NestedMenuItem from '../CardContextMenu/NestedMenuItem';
import { useGameDialogsContext } from '../../ui/GameDialogsContext';
import { useGameId } from '../../ui/GameIdContext';
import { useLocalIdentity } from '../../../hooks/useLocalIdentity';

import { useHandContextMenu } from './useHandContextMenu';

import './HandContextMenu.css';

function HandContextMenu() {
  const dialogs = useGameDialogsContext();
  const gameId = useGameId();
  const { localPlayerId } = useLocalIdentity();
  const handMenu = dialogs.handMenu;
  const isOpen = handMenu != null;
  const anchorPosition = handMenu;

  // Hand size for the mulligan affordances, derived from the local player's HAND
  // zone (was computed in Game and passed as a prop).
  const handZone = useAppSelector((state) =>
    gameId != null && localPlayerId != null
      ? games.Selectors.getZone(state, gameId, localPlayerId, ZoneName.HAND)
      : undefined,
  );
  const handSize = handZone?.cardCount ?? 0;

  const {
    handleChoose,
    handleSameSize,
    handleMinusOne,
    handleRevealHand,
    handleRevealRandom,
    handleViewHand,
    handleSortBy,
    handleMoveToDeck,
    handleMoveToZone,
  } = useHandContextMenu({
    gameId,
    handSize,
    onClose: dialogs.closeHandMenu,
    onRequestChooseMulligan: dialogs.handleRequestChooseMulligan,
    onRequestRevealHand: dialogs.handleRequestRevealHand,
    onRequestRevealRandom: dialogs.handleRequestRevealRandom,
    onRequestViewHand: dialogs.handleRequestViewHand,
    onRequestSortHandBy: dialogs.handleRequestSortHandBy,
    onRequestMoveHandToDeck: dialogs.handleRequestMoveHandToDeck,
    onRequestMoveHandToZone: dialogs.handleRequestMoveHandToZone,
  });

  return (
    <Menu
      open={isOpen}
      onClose={dialogs.closeHandMenu}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition ?? undefined}
      data-testid="hand-context-menu"
      className="hand-context-menu"
    >
      <MenuItem onClick={handleViewHand} disabled={handSize === 0}>
        View hand
      </MenuItem>
      <NestedMenuItem label="Sort hand by" parentMenuOpen={isOpen} disabled={handSize === 0}>
        <MenuItem onClick={() => handleSortBy('name')}>Name</MenuItem>
        <MenuItem onClick={() => handleSortBy('maintype')}>Type</MenuItem>
        <MenuItem onClick={() => handleSortBy('manacost')}>Mana value</MenuItem>
      </NestedMenuItem>
      <Divider />
      <MenuItem onClick={handleChoose}>Take mulligan (choose size)…</MenuItem>
      <MenuItem onClick={handleSameSize} disabled={handSize === 0}>
        Take mulligan (same size)
      </MenuItem>
      <MenuItem onClick={handleMinusOne}>
        Take mulligan (size − 1)
      </MenuItem>
      <Divider />
      <MenuItem onClick={handleRevealHand}>Reveal hand to…</MenuItem>
      <MenuItem onClick={handleRevealRandom} disabled={handSize === 0}>
        Reveal random card to…
      </MenuItem>
      <Divider />
      <NestedMenuItem label="Move hand to" parentMenuOpen={isOpen} disabled={handSize === 0}>
        <MenuItem onClick={() => handleMoveToDeck(true)}>Top of library</MenuItem>
        <MenuItem onClick={() => handleMoveToDeck(false)}>Bottom of library</MenuItem>
        <MenuItem onClick={() => handleMoveToZone(ZoneName.GRAVE)}>Graveyard</MenuItem>
        <MenuItem onClick={() => handleMoveToZone(ZoneName.EXILE)}>Exile</MenuItem>
      </NestedMenuItem>
    </Menu>
  );
}

export default memo(HandContextMenu);
