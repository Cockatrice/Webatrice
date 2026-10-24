import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rooms, server } from '@cockatrice/datatrice';
import type { CommandFailedPayload, RoomCommandFailedPayload } from '@cockatrice/datatrice';

import { AlertDialog } from '@app/dialogs';
import { useCommandFailureMessage, useReduxEffect } from '@app/hooks';

interface Notice {
  title: string;
  message: string;
}

export default function CommandFailureNotices() {
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const [notices, setNotices] = useState<Notice[]>([]);

  const push = (notice: Notice) => setNotices((queue) => [...queue, notice]);

  useReduxEffect<RoomCommandFailedPayload>(({ payload: { failure } }) => {
    push({
      title: t('CommandFailureNotices.createGame.title'),
      message: describeFailure(failure, t('CommandFailureNotices.createGame.serverError')),
    });
  }, rooms.Types.CREATE_GAME_FAILED, [describeFailure, t]);

  useReduxEffect<CommandFailedPayload>(({ payload: { failure } }) => {
    push({
      title: t('CommandFailureNotices.deckUpload.title'),
      message: describeFailure(failure, t('CommandFailureNotices.deckUpload.serverError')),
    });
  }, server.Types.DECK_UPLOAD_FAILED, [describeFailure, t]);

  const current = notices[0];
  if (!current) {
    return null;
  }

  return (
    <AlertDialog
      isOpen
      title={current.title}
      message={current.message}
      onDismiss={() => setNotices((queue) => queue.slice(1))}
    />
  );
}
