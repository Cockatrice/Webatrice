import { useWebClient } from '@app/hooks';

export type HandSortKey = 'name' | 'maintype' | 'manacost';

export interface HandContextMenu {
  handleChoose: () => void;
  handleSameSize: () => void;
  handleMinusOne: () => void;
  handleRevealHand: () => void;
  handleRevealRandom: () => void;
  handleViewHand: () => void;
  handleSortBy: (key: HandSortKey) => void;
  handleMoveToDeck: (top: boolean) => void;
  handleMoveToZone: (zone: string) => void;
}

export interface UseHandContextMenuArgs {
  gameId: number;
  handSize: number;
  onClose: () => void;
  onRequestChooseMulligan: () => void;
  onRequestRevealHand: () => void;
  onRequestRevealRandom: () => void;
  onRequestViewHand: () => void;
  onRequestSortHandBy: (key: HandSortKey) => void;
  onRequestMoveHandToDeck: (top: boolean) => void;
  onRequestMoveHandToZone: (zone: string) => void;
}

export function useHandContextMenu({
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
}: UseHandContextMenuArgs): HandContextMenu {
  const webClient = useWebClient();

  const handleChoose = () => {
    if (gameId <= 0) {
      return;
    }
    onRequestChooseMulligan();
    onClose();
  };

  const handleSameSize = () => {
    if (gameId <= 0) {
      return;
    }
    webClient.request.game.mulligan(gameId, { number: handSize });
    onClose();
  };

  const handleMinusOne = () => {
    if (gameId <= 0) {
      return;
    }
    // Desktop's actMulliganMinusOne floors at 1 (see
    // cockatrice/src/game/player/player_actions.cpp actMulliganMinusOne);
    // the server-side doMulligan rejects number < 1.
    const next = Math.max(1, handSize - 1);
    webClient.request.game.mulligan(gameId, { number: next });
    onClose();
  };

  const handleRevealHand = () => {
    if (gameId <= 0) {
      return;
    }
    onRequestRevealHand();
    onClose();
  };

  const handleRevealRandom = () => {
    if (gameId <= 0) {
      return;
    }
    onRequestRevealRandom();
    onClose();
  };

  const handleViewHand = () => {
    if (gameId <= 0) {
      return;
    }
    onRequestViewHand();
    onClose();
  };

  const handleSortBy = (key: HandSortKey) => {
    if (gameId <= 0) {
      return;
    }
    onRequestSortHandBy(key);
    onClose();
  };

  const handleMoveToDeck = (top: boolean) => {
    if (gameId <= 0) {
      return;
    }
    onRequestMoveHandToDeck(top);
    onClose();
  };

  const handleMoveToZone = (zone: string) => {
    if (gameId <= 0) {
      return;
    }
    onRequestMoveHandToZone(zone);
    onClose();
  };

  return {
    handleChoose,
    handleSameSize,
    handleMinusOne,
    handleRevealHand,
    handleRevealRandom,
    handleViewHand,
    handleSortBy,
    handleMoveToDeck,
    handleMoveToZone,
  };
}
