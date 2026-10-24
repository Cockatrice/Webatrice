import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { games, type GameCommandFailedPayload } from '@cockatrice/datatrice';
import { useCommandFailureMessage, useGameDeckCommands, useReduxEffect, useRequestTracker } from '@app/hooks';
import { validateCod } from '@app/services';

export function useLobbyDeckSelect(gameId: number) {
  const { t } = useTranslation();
  const commands = useGameDeckCommands(gameId);
  const deckSelectRequest = useRequestTracker();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const handleFilePicked = (file: File | null) => {
    setUploadError(null);
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const xml = typeof reader.result === 'string' ? reader.result : '';
      if (!validateCod(xml)) {
        setUploadError(t('DeckSelectDialog.error.invalidCod'));
        return;
      }
      setMyPickedDeckId(null);
      setDeckSelectError(null);
      commands.selectDeck({ deck: xml }, deckSelectRequest.begin());
      // No gameSay: Cockatrice already emits an event message
      // ("X has loaded a deck (…)") when the server processes deckSelect.
    };
    reader.onerror = () => setUploadError(t('DeckSelectDialog.error.readFile'));
    reader.readAsText(file);
  };

  // Remember which local deck the player just picked so the local
  // player row can show its bracket badge. Cockatrice broadcasts each
  // player's `deckHash` on the wire but NOT the deck's server-side
  // id, so we can't map remote players' deckHash back to a bracket
  // without an out-of-band channel. That means the badge on player
  // rows only reflects the LOCAL player today; remote players'
  // rows stay bracket-less unless we later broadcast via gameSay or
  // upstream Cockatrice grows bracket in ServerInfo_PlayerProperties.
  const [myPickedDeckId, setMyPickedDeckId] = useState<number | null>(null);

  const [deckSelectError, setDeckSelectError] = useState<string | null>(null);
  const describeFailure = useCommandFailureMessage();
  useReduxEffect<GameCommandFailedPayload>(
    ({ payload }) => {
      if (payload.gameId !== gameId || !deckSelectRequest.isCurrent(payload.requestId)) {
        return;
      }
      deckSelectRequest.cancel();
      setMyPickedDeckId(null);
      setDeckSelectError(describeFailure(payload.failure, t('GameLobby.deckSelectFailed')));
    },
    games.Types.DECK_SELECT_FAILED,
    [gameId, describeFailure, t, deckSelectRequest],
  );

  useReduxEffect<{ gameId: number; requestId?: string }>(
    ({ payload }) => {
      if (payload.gameId === gameId && deckSelectRequest.isCurrent(payload.requestId)) {
        deckSelectRequest.cancel();
      }
    },
    games.Types.DECK_SELECTED,
    [gameId, deckSelectRequest],
  );

  const handleSelectDeck = (deckId: number) => {
    setMyPickedDeckId(deckId);
    setUploadError(null);
    setDeckSelectError(null);
    commands.selectDeck({ deckId }, deckSelectRequest.begin());
    // No gameSay: Cockatrice emits its own event
    // ("X has loaded a deck (…)") on the deckHash property update.
  };
  const [forceStartConfirmOpen, setForceStartConfirmOpen] = useState(false);
  const confirmForceStart = () => {
    setForceStartConfirmOpen(false);
    commands.readyStart({ ready: true, forceStart: true });
  };

  return {
    fileInputRef, uploadError, handleFilePicked, myPickedDeckId, deckSelectError, handleSelectDeck,
    forceStartConfirmOpen, setForceStartConfirmOpen, confirmForceStart, kickPlayer: commands.kick,
  };
}
