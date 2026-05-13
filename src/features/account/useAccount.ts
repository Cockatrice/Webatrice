import { useEffect, useMemo } from 'react';

import { useWebClient } from 'datatrice/react';
import { server } from 'datatrice';
import { useAppSelector } from '@app/store';
import { ServerInfo_User } from 'sockatrice/generated';
export interface Account {
  buddyList: ServerInfo_User[];
  ignoreList: ServerInfo_User[];
  serverName: string | undefined;
  serverVersion: string | undefined;
  user: ServerInfo_User | null;
  avatarUrl: string;
  handleAddToBuddies: (args: { userName: string }) => void;
  handleAddToIgnore: (args: { userName: string }) => void;
  handleDisconnect: () => void;
}

export function useAccount(): Account {
  const buddyList = useAppSelector((state) => server.Selectors.getSortedBuddyList(state));
  const ignoreList = useAppSelector((state) => server.Selectors.getSortedIgnoreList(state));
  const serverName = useAppSelector((state) => server.Selectors.getName(state));
  const serverVersion = useAppSelector((state) => server.Selectors.getVersion(state));
  const user = useAppSelector((state) => server.Selectors.getUser(state));
  const webClient = useWebClient();
  const avatarBmp = user?.avatarBmp;

  const avatarUrl = useMemo(() => {
    if (!avatarBmp) {
      return '';
    }
    // Cast: avatarBmp is `Uint8Array<ArrayBufferLike>` from generated protos but
    // Blob's BlobPart wants `Uint8Array<ArrayBuffer>`. The runtime is identical.
    return URL.createObjectURL(new Blob([avatarBmp as BlobPart], { type: 'image/png' }));
  }, [avatarBmp]);

  useEffect(() => {
    return () => {
      if (avatarUrl) {
        URL.revokeObjectURL(avatarUrl);
      }
    };
  }, [avatarUrl]);

  const handleAddToBuddies = ({ userName }: { userName: string }) => {
    webClient.request.session.addToBuddyList(userName);
  };

  const handleAddToIgnore = ({ userName }: { userName: string }) => {
    webClient.request.session.addToIgnoreList(userName);
  };

  const handleDisconnect = () => {
    webClient.request.authentication.disconnect();
  };

  return {
    buddyList,
    ignoreList,
    serverName,
    serverVersion,
    user,
    avatarUrl,
    handleAddToBuddies,
    handleAddToIgnore,
    handleDisconnect,
  };
}
