import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Check from '@mui/icons-material/Check';

import { App } from '@app/types';

import NestedMenuItem from '../CardContextMenu/NestedMenuItem';

import { useZoneContextMenu } from './useZoneContextMenu';

import './ZoneContextMenu.css';

export interface ZoneContextMenuProps {
  isOpen: boolean;
  anchorPosition: { top: number; left: number } | null;
  gameId: number;
  playerId: number | null;
  zoneName: string | null;
  onClose: () => void;
  onRequestDrawN: () => void;
  onRequestDumpN: () => void;
  onRequestRevealTopN: () => void;
  onRequestRevealZone: () => void;
  // Library extended actions
  onRequestUndoDraw: () => void;
  onRequestDrawBottom: () => void;
  onRequestMoveTopCardToZone: (zone: string, options?: { x?: number }) => void;
  onRequestPlayTop: (faceDown: boolean) => void;
  onRequestMoveTopNToZone: (zone: string) => void;
  onRequestShuffleTopN: () => void;
  onRequestShuffleBottomN: () => void;
  // View zone (reuses zone-view dialog)
  onRequestViewZone: () => void;
  // Graveyard / Exile actions
  onRequestMoveAllFromZoneToDeck: (top: boolean) => void;
  onRequestMoveAllFromZoneTo: (targetZone: string) => void;
  onRequestRevealRandomFromZone: () => void;
}

function ZoneContextMenu(props: ZoneContextMenuProps) {
  const {
    isOpen,
    anchorPosition,
    zoneName,
    onClose,
    onRequestDrawN,
    onRequestDumpN,
    onRequestRevealTopN,
    onRequestRevealZone,
    onRequestUndoDraw,
    onRequestDrawBottom,
    onRequestMoveTopCardToZone,
    onRequestPlayTop,
    onRequestMoveTopNToZone,
    onRequestShuffleTopN,
    onRequestShuffleBottomN,
    onRequestViewZone,
    onRequestMoveAllFromZoneToDeck,
    onRequestMoveAllFromZoneTo,
    onRequestRevealRandomFromZone,
  } = props;
  const {
    ready,
    alwaysReveal,
    alwaysLook,
    handleDrawOne,
    handleShuffle,
    handleRevealTop,
    handleToggleAlwaysReveal,
    handleToggleAlwaysLook,
    runAndClose,
  } = useZoneContextMenu(props);

  if (!ready) {
    return null;
  }

  if (zoneName === App.ZoneName.DECK) {
    return (
      <Menu
        open={isOpen}
        onClose={onClose}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition ?? undefined}
        data-testid="zone-context-menu"
        className="zone-context-menu"
      >
        <MenuItem onClick={runAndClose(handleDrawOne)}>Draw a card</MenuItem>
        <MenuItem onClick={runAndClose(onRequestDrawN)}>Draw N cards…</MenuItem>
        <MenuItem onClick={runAndClose(onRequestDrawBottom)}>Draw bottom card</MenuItem>
        <MenuItem onClick={runAndClose(onRequestUndoDraw)}>Undo draw</MenuItem>
        <Divider />
        <NestedMenuItem label="Move top card to" parentMenuOpen={isOpen}>
          <MenuItem onClick={runAndClose(() => onRequestPlayTop(false))}>
            Battlefield (play)
          </MenuItem>
          <MenuItem onClick={runAndClose(() => onRequestPlayTop(true))}>
            Battlefield face down
          </MenuItem>
          <MenuItem onClick={runAndClose(() => onRequestMoveTopCardToZone(App.ZoneName.GRAVE))}>
            Graveyard
          </MenuItem>
          <MenuItem onClick={runAndClose(() => onRequestMoveTopCardToZone(App.ZoneName.EXILE))}>
            Exile
          </MenuItem>
          <MenuItem onClick={runAndClose(() => onRequestMoveTopCardToZone(App.ZoneName.DECK, { x: -1 }))}>
            Bottom of library
          </MenuItem>
        </NestedMenuItem>
        <NestedMenuItem label="Move top N cards to" parentMenuOpen={isOpen}>
          <MenuItem onClick={runAndClose(() => onRequestMoveTopNToZone(App.ZoneName.GRAVE))}>
            Graveyard…
          </MenuItem>
          <MenuItem onClick={runAndClose(() => onRequestMoveTopNToZone(App.ZoneName.EXILE))}>
            Exile…
          </MenuItem>
        </NestedMenuItem>
        <Divider />
        <MenuItem onClick={runAndClose(handleShuffle)}>Shuffle</MenuItem>
        <MenuItem onClick={runAndClose(onRequestShuffleTopN)}>Shuffle top N…</MenuItem>
        <MenuItem onClick={runAndClose(onRequestShuffleBottomN)}>Shuffle bottom N…</MenuItem>
        <Divider />
        <MenuItem onClick={runAndClose(onRequestViewZone)}>View library…</MenuItem>
        <MenuItem onClick={runAndClose(onRequestDumpN)}>Dump top N…</MenuItem>
        <MenuItem onClick={runAndClose(handleRevealTop)}>Reveal top card to all</MenuItem>
        <MenuItem onClick={runAndClose(onRequestRevealTopN)}>Reveal top N to…</MenuItem>
        <Divider />
        <MenuItem
          onClick={runAndClose(handleToggleAlwaysReveal)}
          className="zone-context-menu__toggle"
        >
          <span className="zone-context-menu__check" aria-hidden>
            {alwaysReveal ? <Check fontSize="inherit" /> : null}
          </span>
          Always reveal top card
        </MenuItem>
        <MenuItem
          onClick={runAndClose(handleToggleAlwaysLook)}
          className="zone-context-menu__toggle"
        >
          <span className="zone-context-menu__check" aria-hidden>
            {alwaysLook ? <Check fontSize="inherit" /> : null}
          </span>
          Always look at top card
        </MenuItem>
      </Menu>
    );
  }

  if (zoneName === App.ZoneName.GRAVE || zoneName === App.ZoneName.EXILE) {
    const isGrave = zoneName === App.ZoneName.GRAVE;
    const otherZone = isGrave ? App.ZoneName.EXILE : App.ZoneName.GRAVE;
    const otherLabel = isGrave ? 'Exile' : 'Graveyard';
    return (
      <Menu
        open={isOpen}
        onClose={onClose}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition ?? undefined}
        data-testid="zone-context-menu"
        className="zone-context-menu"
      >
        <MenuItem onClick={runAndClose(onRequestViewZone)}>
          {isGrave ? 'View graveyard' : 'View exile'}
        </MenuItem>
        <Divider />
        <NestedMenuItem label="Move all to" parentMenuOpen={isOpen}>
          <MenuItem onClick={runAndClose(() => onRequestMoveAllFromZoneToDeck(true))}>
            Top of library
          </MenuItem>
          <MenuItem onClick={runAndClose(() => onRequestMoveAllFromZoneToDeck(false))}>
            Bottom of library
          </MenuItem>
          <MenuItem onClick={runAndClose(() => onRequestMoveAllFromZoneTo(App.ZoneName.HAND))}>
            Hand
          </MenuItem>
          <MenuItem onClick={runAndClose(() => onRequestMoveAllFromZoneTo(otherZone))}>
            {otherLabel}
          </MenuItem>
        </NestedMenuItem>
        <Divider />
        <MenuItem onClick={runAndClose(onRequestRevealZone)}>
          {isGrave ? 'Reveal graveyard to…' : 'Reveal exile to…'}
        </MenuItem>
        <MenuItem onClick={runAndClose(onRequestRevealRandomFromZone)}>
          Reveal random card to…
        </MenuItem>
      </Menu>
    );
  }

  return null;
}

export default ZoneContextMenu;
