import { useState } from 'react';

import { useWebClient } from '@cockatrice/datatrice/react';
import { useLeaveGame } from '@app/hooks';

import { useCurrentGame } from '../../hooks/useCurrentGame';

export interface DeckSelectDialog {
  // Whether the deck-select modal should be shown: a not-yet-started game where
  // the local player is an active (non-spectator, non-judge) participant who
  // hasn't readied up. Folded in here (was derived in Game/useGame) so the
  // dialog self-gates. localPlayer null-check guards the reconnect window before
  // Event_GameStateChanged repopulates players.
  isOpen: boolean;
  deckText: string;
  setDeckText: (v: string) => void;
  fileName: string | null;
  handleFilePicked: (file: File | null) => void;
  validationError: string | null;
  deckHash: string;
  isReady: boolean;
  canSubmit: boolean;
  canToggleReady: boolean;
  handleSubmitDeck: () => void;
  handleToggleReady: () => void;
  handleLeave: () => void;
}

const INVALID_COD_MESSAGE = 'Not a valid Cockatrice deck (.cod) file';

function validateCodXml(xml: string): boolean {
  if (xml.length === 0) {
    return false;
  }
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return false;
  }
  return doc.documentElement?.tagName === 'cockatrice_deck';
}

export function useDeckSelectDialog(gameId: number | undefined): DeckSelectDialog {
  const webClient = useWebClient();
  const leaveGame = useLeaveGame();
  // useCurrentGame falls back to the first active game when gameId is undefined;
  // guard on gameId so the dialog never opens against that fallback (the action
  // handlers below already no-op on a null id).
  const { game, localPlayer, isSpectator, isJudge } = useCurrentGame(gameId);
  const isOpen =
    gameId != null &&
    game != null &&
    localPlayer != null &&
    !game.started &&
    !isSpectator &&
    !isJudge &&
    !localPlayer.properties.readyStart;
  const [deckText, setDeckTextState] = useState('');
  const [fileXml, setFileXml] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const deckHash = localPlayer?.properties.deckHash ?? '';
  const isReady = localPlayer?.properties.readyStart ?? false;
  const hasLocalPlayer = localPlayer != null;
  // Guard Submit/Ready on having a local player — the isOpen predicate above
  // implies one, but the dialog can mount before the Event_GameJoined echo
  // populates players during reconnect.
  const canSubmit =
    hasLocalPlayer && (fileXml != null || deckText.trim().length > 0);
  const canToggleReady = hasLocalPlayer && deckHash.length > 0;

  const setDeckText = (value: string) => {
    setDeckTextState(value);
    if (fileXml != null) {
      setFileXml(null);
      setFileName(null);
    }
    if (validationError != null) {
      setValidationError(null);
    }
  };

  const handleFilePicked = (file: File | null) => {
    if (file == null) {
      setFileXml(null);
      setFileName(null);
      setValidationError(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const contents = typeof reader.result === 'string' ? reader.result : '';
      setFileXml(contents);
      setFileName(file.name);
      setDeckTextState('');
      setValidationError(null);
    };
    reader.onerror = () => {
      setValidationError('Could not read the selected file');
    };
    reader.readAsText(file);
  };

  const handleSubmitDeck = () => {
    if (!canSubmit || gameId == null) {
      return;
    }
    const xml = fileXml ?? deckText.trim();
    if (!validateCodXml(xml)) {
      setValidationError(INVALID_COD_MESSAGE);
      return;
    }
    setValidationError(null);
    webClient.request.game.deckSelect(gameId, { deck: xml });
  };

  const handleToggleReady = () => {
    if (!canToggleReady || gameId == null) {
      return;
    }
    webClient.request.game.readyStart(gameId, { ready: !isReady });
  };

  // Leaving must always be possible: while this modal is open the rest of the
  // app (LeftNav, turn-controls) is behind the MUI backdrop, so the dialog
  // owns the only reachable exit from a game that has not yet started — or
  // one that reverted to lobby after an opponent left.
  const handleLeave = () => {
    if (gameId == null) {
      return;
    }
    leaveGame(gameId);
  };

  return {
    isOpen,
    deckText,
    setDeckText,
    fileName,
    handleFilePicked,
    validationError,
    deckHash,
    isReady,
    canSubmit,
    canToggleReady,
    handleSubmitDeck,
    handleToggleReady,
    handleLeave,
  };
}
