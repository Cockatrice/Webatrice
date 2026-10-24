import { useCallback, useEffect, useRef, useState } from 'react';
import { generatePath, useNavigate } from 'react-router-dom';

import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { WebClient } from '@cockatrice/sockatrice';
import type { GameReplay } from '@cockatrice/sockatrice/generated';
import {
  ReplayEngine,
  allocateReplayGameId,
  getOpenedReplay,
  openReplay,
  parseReplay,
  type OpenedReplay,
  type ReplayGameTarget,
} from '@app/services';
import { onSessionEnd, sessionGeneration } from '@app/services/session';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';

export interface PreviewSource {
  key: string;
  title: string;
  fetch: () => Promise<Uint8Array>;
}

export type PreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ReplayPreviewState {
  status: PreviewStatus;
  key: string | null;
  opened: OpenedReplay | undefined;
  error: string | null;
  load: (source: PreviewSource) => void;
  reset: () => void;
  watchFrom: (time: number) => void;
}

export const PREVIEW_CACHE_SIZE = 8;

const parsedReplays = new Map<string, GameReplay>();

export function connectedEndpoint(webClient: Pick<WebClient, 'socket'>): string {
  return webClient.socket.connectedEndpoint ?? '';
}

export function previewScope(sessionEpoch: number, endpoint: string): string {
  return `${sessionEpoch}@${endpoint}`;
}

export function cachedReplay(scope: string, key: string): GameReplay | undefined {
  return parsedReplays.get(`${scope}/${key}`);
}

export function rememberReplay(scope: string, key: string, replay: GameReplay): void {
  const id = `${scope}/${key}`;
  parsedReplays.delete(id);
  parsedReplays.set(id, replay);
  while (parsedReplays.size > PREVIEW_CACHE_SIZE) {
    parsedReplays.delete(parsedReplays.keys().next().value!);
  }
}

export function clearReplayCache(): void {
  parsedReplays.clear();
}

onSessionEnd(clearReplayCache);

export function createPreviewReplay(key: string, replay: GameReplay, title: string, target: ReplayGameTarget): OpenedReplay {
  const gameId = allocateReplayGameId();
  const gameInfo = replay.gameInfo!;
  const engine = new ReplayEngine(replay, {
    rewind: () => target.loadReplayGame(gameId, gameInfo),
    apply: (container, options) => target.replayGameEventContainer(container, gameId, options),
  });
  engine.load();
  return { key, gameId, title, replay, engine };
}

export function useReplayPreview(): ReplayPreviewState {
  const webClient = useWebClient();
  const navigate = useNavigate();
  const sessionEpoch = useAppSelector(server.Selectors.selectSessionEpoch);
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [key, setKey] = useState<string | null>(null);
  const [opened, setOpened] = useState<OpenedReplay | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const openedRef = useRef<OpenedReplay | undefined>(undefined);
  const requestRef = useRef(0);
  const scope = previewScope(sessionEpoch, connectedEndpoint(webClient));

  const dispose = useCallback(() => {
    const current = openedRef.current;
    if (current) {
      current.engine.dispose();
      webClient.unloadReplayGame(current.gameId);
      openedRef.current = undefined;
    }
    requestRef.current += 1;
  }, [webClient]);

  useEffect(() => dispose, [dispose]);

  const reset = useCallback(() => {
    dispose();
    setOpened(undefined);
    setKey(null);
    setError(null);
    setStatus('idle');
  }, [dispose]);

  useEffect(() => {
    if (status !== 'idle') {
      reset();
    }
  // A new session (or server) invalidates whatever was previewed under the old one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEpoch]);

  const load = useCallback((source: PreviewSource) => {
    dispose();
    const request = requestRef.current;
    const generation = sessionGeneration();
    setOpened(undefined);
    setKey(source.key);
    setError(null);
    setStatus('loading');
    const ready = (replay: GameReplay) => {
      if (requestRef.current !== request) {
        return;
      }
      const preview = createPreviewReplay(source.key, replay, source.title, webClient);
      openedRef.current = preview;
      setOpened(preview);
      setStatus('ready');
    };
    const cached = cachedReplay(scope, source.key);
    if (cached) {
      ready(cached);
      return;
    }
    source.fetch()
      .then((bytes) => {
        const replay = parseReplay(bytes);
        if (sessionGeneration() === generation) {
          rememberReplay(scope, source.key, replay);
        }
        ready(replay);
      })
      .catch((err: unknown) => {
        if (requestRef.current !== request) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });
  }, [dispose, scope, webClient]);

  const watchFrom = useCallback((time: number) => {
    const current = openedRef.current;
    if (!current) {
      return;
    }
    current.engine.pause();
    const replayKey = openReplay(current.replay, current.title, webClient);
    getOpenedReplay(replayKey)?.engine.seek(time);
    navigate(generatePath(RouteEnum.REPLAY, { replayKey }));
  }, [navigate, webClient]);

  return { status, key, opened, error, load, reset, watchFrom };
}
