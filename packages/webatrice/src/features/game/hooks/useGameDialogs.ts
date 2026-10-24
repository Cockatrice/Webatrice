import { useCallback, useMemo } from 'react';
import { useStore } from 'react-redux';

import type { RootState } from '@app/store';
import { useWebClient } from '@cockatrice/datatrice/react';
import { games } from '@cockatrice/datatrice';
import { useJudgeTarget } from './useJudgeTarget';
import type { GameDialogs, GameDialogsActions } from './dialogs/gameDialogs.types';
import type { GameDialogEnv } from './dialogs/gameDialogEnv';
import { useGameDialogState } from './dialogs/useGameDialogState';
import { useZoneDialogActions } from './dialogs/useZoneDialogActions';
import { useLibraryDialogActions } from './dialogs/useLibraryDialogActions';
import { useHandDialogActions } from './dialogs/useHandDialogActions';
import { useGameLifecycleDialogActions } from './dialogs/useGameLifecycleDialogActions';

export * from './dialogs/gameDialogs.types';

export interface UseGameDialogsArgs {
  gameId: number | undefined;
  isSpectator: boolean;
}

export function useGameDialogs({
  gameId,
  isSpectator,
}: UseGameDialogsArgs): GameDialogs {
  const webClient = useWebClient();
  const store = useStore<RootState>();
  const judgeTarget = useJudgeTarget(gameId);

  // Read the latest game / local player from the store at CALL time, never at
  // render time. The action handlers used to close over the `game`/`localPlayer`
  // props, which made every handler — and therefore the memoized return — churn
  // on every game-state update, defeating the dialog/menu `memo()` wrappers during
  // play. These getters depend only on the (stable) store and gameId, so the
  // handlers can drop `game`/`localPlayer` from their dep arrays. Store-read
  // precedent: useReduxEffect.
  const readGame = useCallback(
    () => (gameId != null ? games.Selectors.getGame(store.getState(), gameId) : undefined),
    [store, gameId],
  );
  const readLocalPlayer = useCallback(
    () => (gameId != null ? games.Selectors.getLocalPlayer(store.getState(), gameId) : undefined),
    [store, gameId],
  );
  const env = useMemo<GameDialogEnv>(
    () => ({ gameId, webClient, readGame, readLocalPlayer, judgeTarget }),
    [gameId, webClient, readGame, readLocalPlayer, judgeTarget],
  );
  const { state, set, toggles, createTokenRequest } = useGameDialogState();

  const zone = useZoneDialogActions({
    env,
    zoneViews: state.zoneViews,
    hasSeat: !isSpectator,
    set,
  });
  const library = useLibraryDialogActions({ env, set });
  const hand = useHandDialogActions({ env, set });
  const lifecycle = useGameLifecycleDialogActions({ env, set, createTokenRequest });

  // The action surface is decoupled from game state (handlers read the latest
  // game/local-player from the store at call time), so it only changes when a
  // handler's own inputs (an open menu, the zone-view stack) change. The merged
  // value below then changes only with dialog STATE, letting the propless,
  // memo()'d dialogs/menus skip the per-frame Game re-renders during play.
  const actions = useMemo<GameDialogsActions>(
    () => ({ ...toggles, ...zone, ...library, ...hand, ...lifecycle }),
    [toggles, zone, library, hand, lifecycle],
  );

  return useMemo<GameDialogs>(() => ({ ...state, ...actions }), [state, actions]);
}
