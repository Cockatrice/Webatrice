import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';

import { ZoneName } from 'datatrice';
import NestedMenuItem from '../CardContextMenu/NestedMenuItem';

import { useHandContextMenu } from './useHandContextMenu';

import './HandContextMenu.css';

export interface HandContextMenuProps {
  isOpen: boolean;
  anchorPosition: { top: number; left: number } | null;
  gameId: number;
  handSize: number;
  onClose: () => void;
  onRequestChooseMulligan: () => void;
  onRequestRevealHand: () => void;
  onRequestRevealRandom: () => void;
  onRequestViewHand: () => void;
  onRequestSortHandBy: (key: 'name' | 'maintype' | 'manacost') => void;
  onRequestMoveHandToDeck: (top: boolean) => void;
  onRequestMoveHandToZone: (zone: string) => void;
}

function HandContextMenu({
  isOpen,
  anchorPosition,
  gameId,
  handSize,
  onClose,
  onRequestChooseMulligan,
  onRequestRevealHand,
  onRequestRevealRandom,
  onRequestViewHand,
  onRequestSortHandBy,
  onRequestMoveHandToDeck,
  onRequestMoveHandToZone,
}: HandContextMenuProps) {
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
    onClose,
    onRequestChooseMulligan,
    onRequestRevealHand,
    onRequestRevealRandom,
    onRequestViewHand,
    onRequestSortHandBy,
    onRequestMoveHandToDeck,
    onRequestMoveHandToZone,
  });

  return (
    <Menu
      open={isOpen}
      onClose={onClose}
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

export default HandContextMenu;
