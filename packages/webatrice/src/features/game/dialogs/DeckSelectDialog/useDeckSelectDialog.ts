import { useState } from 'react';

import { useWebClient } from '@cockatrice/datatrice/react';
import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { useLeaveGame } from '@app/hooks';

export interface DeckSelectDialog {
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
  const localPlayer = useAppSelector((state) =>
    gameId != null ? games.Selectors.getLocalPlayer(state, gameId) : undefined,
  );
  const [deckText, setDeckTextState] = useState('');
  const [fileXml, setFileXml] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const deckHash = localPlayer?.properties.deckHash ?? '';
  const isReady = localPlayer?.properties.readyStart ?? false;
  const hasLocalPlayer = localPlayer != null;
  // Guard Submit/Ready on having a local player — today the deckSelectOpen
  // predicate in Game.tsx implies one, but the dialog mounts before the
  // Event_GameJoined echo populates players during reconnect.
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
