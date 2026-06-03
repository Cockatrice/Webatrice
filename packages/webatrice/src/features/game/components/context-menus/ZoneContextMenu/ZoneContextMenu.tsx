import { ZoneName } from '@cockatrice/sockatrice';
import { memo } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Check from '@mui/icons-material/Check';

import NestedMenuItem from '../CardContextMenu/NestedMenuItem';
import { useGameDialogsContext } from '../../ui/GameDialogsContext';
import { useGameId } from '../../ui/GameIdContext';

import { useZoneContextMenu } from './useZoneContextMenu';

import './ZoneContextMenu.css';

function ZoneContextMenu() {
  const dialogs = useGameDialogsContext();
  const gameId = useGameId();
  const zoneMenu = dialogs.zoneMenu;
  const isOpen = zoneMenu != null;
  const anchorPosition = zoneMenu?.anchorPosition ?? null;
  const playerId = zoneMenu?.playerId ?? null;
  const zoneName = zoneMenu?.zoneName ?? null;
  const onClose = dialogs.closeZoneMenu;
  // Parent-owned (prompt/dialog-opening) actions, sourced from the dialogs slice
  // under the names the menu items already use.
  const {
    handleRequestDrawN: onRequestDrawN,
    handleRequestDumpN: onRequestDumpN,
    handleRequestRevealTopN: onRequestRevealTopN,
    handleRequestRevealZone: onRequestRevealZone,
    handleRequestUndoDraw: onRequestUndoDraw,
    handleRequestDrawBottom: onRequestDrawBottom,
    handleRequestMoveTopCardToZone: onRequestMoveTopCardToZone,
    handleRequestPlayTop: onRequestPlayTop,
    handleRequestMoveTopNToZone: onRequestMoveTopNToZone,
    handleRequestShuffleTopN: onRequestShuffleTopN,
    handleRequestShuffleBottomN: onRequestShuffleBottomN,
    handleRequestViewZone: onRequestViewZone,
    handleRequestMoveAllFromZoneToDeck: onRequestMoveAllFromZoneToDeck,
    handleRequestMoveAllFromZoneTo: onRequestMoveAllFromZoneTo,
    handleRequestRevealRandomFromZone: onRequestRevealRandomFromZone,
  } = dialogs;
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
  } = useZoneContextMenu({ gameId, playerId, zoneName, onClose });

  if (!ready) {
    return null;
  }

  if (zoneName === ZoneName.DECK) {
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
          <MenuItem onClick={runAndClose(() => onRequestMoveTopCardToZone(ZoneName.GRAVE))}>
            Graveyard
          </MenuItem>
          <MenuItem onClick={runAndClose(() => onRequestMoveTopCardToZone(ZoneName.EXILE))}>
            Exile
          </MenuItem>
          <MenuItem onClick={runAndClose(() => onRequestMoveTopCardToZone(ZoneName.DECK, { x: -1 }))}>
            Bottom of library
          </MenuItem>
        </NestedMenuItem>
        <NestedMenuItem label="Move top N cards to" parentMenuOpen={isOpen}>
          <MenuItem onClick={runAndClose(() => onRequestMoveTopNToZone(ZoneName.GRAVE))}>
            Graveyard…
          </MenuItem>
          <MenuItem onClick={runAndClose(() => onRequestMoveTopNToZone(ZoneName.EXILE))}>
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

  if (zoneName === ZoneName.GRAVE || zoneName === ZoneName.EXILE) {
    const isGrave = zoneName === ZoneName.GRAVE;
    const otherZone = isGrave ? ZoneName.EXILE : ZoneName.GRAVE;
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
          <MenuItem onClick={runAndClose(() => onRequestMoveAllFromZoneTo(ZoneName.HAND))}>
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

export default memo(ZoneContextMenu);
