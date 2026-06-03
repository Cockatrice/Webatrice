import { ZoneName } from '@cockatrice/sockatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
export interface ZoneContextMenu {
  ready: boolean;
  alwaysReveal: boolean;
  alwaysLook: boolean;
  handleDrawOne: () => void;
  handleShuffle: () => void;
  handleRevealTop: () => void;
  handleToggleAlwaysReveal: () => void;
  handleToggleAlwaysLook: () => void;
  runAndClose: (fn: () => void) => () => void;
}

export interface UseZoneContextMenuArgs {
  gameId: number | undefined;
  playerId: number | null;
  zoneName: string | null;
  onClose: () => void;
}

export function useZoneContextMenu({
  gameId,
  playerId,
  zoneName,
  onClose,
}: UseZoneContextMenuArgs): ZoneContextMenu {
  const webClient = useWebClient();

  const zone = useAppSelector((state) =>
    gameId != null && playerId != null && zoneName != null
      ? games.Selectors.getZone(state, gameId, playerId, zoneName)
      : undefined,
  );

  const ready = gameId != null && playerId != null && zoneName != null;
  const alwaysReveal = zone?.alwaysRevealTopCard ?? false;
  const alwaysLook = zone?.alwaysLookAtTopCard ?? false;

  // Close-then-act helpers (avoid duplicating onClose at every site).
  const runAndClose = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const handleDrawOne = () => {
    if (gameId == null) {
      return;
    }
    webClient.request.game.drawCards(gameId, { number: 1 });
  };

  const handleShuffle = () => {
    if (gameId == null) {
      return;
    }
    webClient.request.game.shuffle(gameId, { zoneName: ZoneName.DECK, start: 0, end: -1 });
  };

  const handleRevealTop = () => {
    if (gameId == null) {
      return;
    }
    webClient.request.game.revealCards(gameId, {
      zoneName: ZoneName.DECK,
      playerId: -1,
      topCards: 1,
    });
  };

  const handleToggleAlwaysReveal = () => {
    if (gameId == null) {
      return;
    }
    webClient.request.game.changeZoneProperties(gameId, {
      zoneName: ZoneName.DECK,
      alwaysRevealTopCard: !alwaysReveal,
    });
  };

  const handleToggleAlwaysLook = () => {
    if (gameId == null) {
      return;
    }
    webClient.request.game.changeZoneProperties(gameId, {
      zoneName: ZoneName.DECK,
      alwaysLookAtTopCard: !alwaysLook,
    });
  };

  return {
    ready,
    alwaysReveal,
    alwaysLook,
    handleDrawOne,
    handleShuffle,
    handleRevealTop,
    handleToggleAlwaysReveal,
    handleToggleAlwaysLook,
    runAndClose,
  };
}
