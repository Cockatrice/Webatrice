import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { server } from '@cockatrice/datatrice';
import { usePeer, type PeerViewModel } from '@app/feature-widgets/chat-dock';
import { useAppDispatch, useAppSelector } from '@app/store';

export type PlayerViewModel = PeerViewModel;

export function usePlayer(): PlayerViewModel {
  const params = useParams<{ name?: string }>();
  const peer = usePeer(params.name ?? null);
  const dispatch = useAppDispatch();
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const { name, isSelf } = peer;

  useEffect(() => {
    if (isConnected && name && !isSelf) {
      dispatch(server.Actions.privateChatOpened({ userName: name }));
    }
  }, [dispatch, isConnected, name, isSelf]);

  return peer;
}
