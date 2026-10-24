import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'lucide-react';

import type { ServerInfo_Game } from '@cockatrice/sockatrice/generated';
import { usePushToast } from '@app/components';
import { useLiveServerEndpoint } from '@app/feature-widgets/known-hosts';
import { makeGameJoinLink } from '@app/utils';

export interface GameLinkCopy {
  available: boolean;
  unavailableReason: string | null;
  copy: (game: ServerInfo_Game) => void;
}

export function useGameLink(): GameLinkCopy {
  const { t } = useTranslation();
  const liveServer = useLiveServerEndpoint();
  const pushToast = usePushToast();
  const desktopPort = liveServer?.desktopPort;
  const hostname = liveServer?.hostname;

  const copy = useCallback((game: ServerInfo_Game) => {
    if (!desktopPort || !hostname) {
      return;
    }
    const link = makeGameJoinLink({
      hostname,
      port: desktopPort,
      roomId: game.roomId,
      gameId: game.gameId,
      description: game.description,
    });
    navigator.clipboard.writeText(link).then(
      () => pushToast(t('GameInvite.linkCopied'), { icon: Link }),
      () => pushToast(t('GameInvite.linkCopyFailed'), { icon: Link }),
    );
  }, [desktopPort, hostname, pushToast, t]);

  return {
    available: Boolean(desktopPort),
    unavailableReason: liveServer && !desktopPort ? t('GameInvite.desktopPortRequired') : null,
    copy,
  };
}
