import { useTranslation } from 'react-i18next';

import { AlertDialog, ConfirmDialog, PromptDialog } from '@app/dialogs';
import { useJoinGameErrorMessage } from '@app/hooks';

import type { JoinFriendGame } from './useJoinFriendGame';

export default function JoinPrompts({ flow }: { flow: JoinFriendGame }) {
  const { t } = useTranslation();
  const joinErrorMessage = useJoinGameErrorMessage(flow.joinError);
  return (
    <>
      <ConfirmDialog
        cancelDefault
        title={t('GameLink.confirm.title')}
        message={t('GameLink.full')}
        confirmLabel={t('GameLink.yes')}
        cancelLabel={t('GameLink.no')}
        isOpen={flow.spectatorConfirmationRequired}
        onConfirm={flow.confirmSpectatorJoin}
        onCancel={flow.cancelSpectatorJoin}
      />
      <PromptDialog
        isOpen={flow.passwordRequired}
        title={t('UserGamesDialog.password.title')}
        type="password"
        label={flow.passwordGame?.description
          ? t('UserGamesDialog.password.label', { name: flow.passwordGame.description })
          : t('UserGamesDialog.password.gameIdLabel', { gameId: flow.passwordGame?.gameId })}
        submitLabel={t('UserGamesDialog.password.submit')}
        onSubmit={flow.submitPassword}
        onCancel={flow.cancelPassword}
      />
      <AlertDialog
        isOpen={flow.joinError !== null || flow.roomTimedOut}
        title={t('UserGamesDialog.error.title')}
        message={flow.roomTimedOut ? t('People.join.roomTimeout') : joinErrorMessage}
        onDismiss={() => (flow.roomTimedOut ? flow.dismissRoomTimeout() : flow.clearJoinError())}
      />
    </>
  );
}
