import { ZoneName } from '@cockatrice/sockatrice';
import { games } from '@cockatrice/datatrice';
import { useCallback, useMemo } from 'react';

import { useAppDispatch } from '@app/store';
import type { CreateTokenRequest, GameDialogsActions } from './gameDialogs.types';
import type { GameDialogEnv } from './gameDialogEnv';
import type { GameDialogSetters } from './useGameDialogState';

export type GameLifecycleDialogActions = Pick<
  GameDialogsActions,
  | 'handleRollDieSubmit'
  | 'handleCreateTokenSubmit'
  | 'confirmConcede'
  | 'confirmUnconcede'
  | 'confirmLeave'
>;

export interface UseGameLifecycleDialogActionsArgs {
  env: GameDialogEnv;
  set: Pick<
    GameDialogSetters,
    | 'setRollDieOpen'
    | 'setLastDieSides'
    | 'setLastDieCount'
    | 'setCreateTokenRequest'
    | 'setConcedeConfirm'
    | 'setLeaveConfirm'
  >;
  createTokenRequest: CreateTokenRequest | null;
}

export function useGameLifecycleDialogActions({
  env,
  set,
  createTokenRequest,
}: UseGameLifecycleDialogActionsArgs): GameLifecycleDialogActions {
  const { gameId, webClient } = env;
  const {
    setRollDieOpen,
    setLastDieSides,
    setLastDieCount,
    setCreateTokenRequest,
    setConcedeConfirm,
    setLeaveConfirm,
  } = set;
  const dispatch = useAppDispatch();

  const handleRollDieSubmit = useCallback(
    ({ sides, count }: { sides: number; count: number }) => {
      if (gameId == null) {
        return;
      }
      webClient.request.game.rollDie(gameId, { sides, count });
      setLastDieSides(sides);
      setLastDieCount(count);
      setRollDieOpen(false);
    },
    [gameId, webClient, setLastDieSides, setLastDieCount, setRollDieOpen],
  );

  const handleCreateTokenSubmit = useCallback(
    (args: {
      name: string;
      color: string;
      pt: string;
      annotation: string;
      destroyOnZoneChange: boolean;
      faceDown: boolean;
      providerId?: string;
    }) => {
      if (createTokenRequest?.onSubmit) {
        createTokenRequest.onSubmit(args);
        setCreateTokenRequest(null);
        return;
      }
      if (gameId == null) {
        return;
      }
      webClient.request.game.createToken(gameId, {
        zone: ZoneName.TABLE,
        cardName: args.name,
        color: args.color,
        pt: args.pt,
        annotation: args.annotation,
        destroyOnZoneChange: args.destroyOnZoneChange,
        x: 0,
        y: 0,
        faceDown: args.faceDown,
        targetCardId: -1,
        cardProviderId: args.providerId ?? '',
      });
      setCreateTokenRequest(null);
    },
    [gameId, webClient, setCreateTokenRequest, createTokenRequest],
  );

  const confirmConcede = useCallback(() => {
    if (gameId != null) {
      webClient.request.game.concede(gameId);
    }
    setConcedeConfirm(null);
  }, [gameId, webClient, setConcedeConfirm]);

  const confirmUnconcede = useCallback(() => {
    if (gameId != null) {
      webClient.request.game.unconcede(gameId);
    }
    setConcedeConfirm(null);
  }, [gameId, webClient, setConcedeConfirm]);

  // Fire Command_LeaveGame and mirror useLeaveGame's local dispatch —
  // servatrice strips the leaver from Event_Leave before broadcast so
  // the client would never see itself leave without this. Same pattern
  // as `useLeaveGame`; kept here so the confirm flow owns the whole
  // side effect.
  const confirmLeave = useCallback(() => {
    if (gameId != null) {
      webClient.request.game.leaveGame(gameId);
      dispatch(games.Actions.gameLeft({ gameId }));
    }
    setLeaveConfirm(false);
  }, [gameId, webClient, dispatch, setLeaveConfirm]);

  return useMemo(
    () => ({
      handleRollDieSubmit,
      handleCreateTokenSubmit,
      confirmConcede,
      confirmUnconcede,
      confirmLeave,
    }),
    [
      handleRollDieSubmit,
      handleCreateTokenSubmit,
      confirmConcede,
      confirmUnconcede,
      confirmLeave,
    ],
  );
}
