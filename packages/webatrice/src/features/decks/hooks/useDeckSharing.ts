import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { server, ServerCapability } from '@cockatrice/datatrice';
import type { SessionCommandFailedPayload } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { DeckSetVisibilityParams, DeckShareCreateParams, Response_DeckShareCreate } from '@cockatrice/sockatrice/generated';
import { useCommandFailureMessage, useReduxEffect, useRequestTracker } from '@app/hooks';
import { useAppSelector } from '@app/store';
import { useKnownHosts } from '@app/feature-widgets/known-hosts';

import { buildDeckShareLink, shareServerFromEndpoint } from '../deckSharing';
import type { DeckVisibility } from '../deckTree';

export function useDeckSharingSupported(): boolean {
  return useAppSelector((state) => server.Selectors.supports(state, ServerCapability.DECK_SHARING));
}

export function useShareServer(): { hostname: string; port: string; desktopPort?: string } | null {
  const webClient = useWebClient();
  const connected = useAppSelector(server.Selectors.getIsConnected);
  const knownHosts = useKnownHosts();
  const live = connected ? shareServerFromEndpoint(webClient.socket?.connectedEndpoint) : null;
  if (!live) {
    return null;
  }
  const protocol = new URL(live.hostname).protocol;
  const host = knownHosts.value?.hosts?.find(candidate => {
    const address = candidate.host.includes('/') ? candidate.host : `${candidate.host}:${candidate.port}`;
    return shareServerFromEndpoint(`${protocol}//${address}`)?.hostname === live.hostname;
  });
  return { ...live, desktopPort: host?.desktopPort };
}

export type DeckShareCreateState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'created'; link: string; expiresAt: bigint; itemCount: number; copied: boolean }
  | { status: 'failed'; message: string };

export async function copyShareLink(link: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    return false;
  }
}

export function useDeckShareCreate() {
  const webClient = useWebClient();
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const shareServer = useShareServer();
  const [state, setState] = useState<DeckShareCreateState>({ status: 'idle' });
  const requests = useRequestTracker();
  const requestServer = useRef<NonNullable<typeof shareServer> | null>(null);

  useReduxEffect<{ share: Response_DeckShareCreate; requestId?: string }>(({ payload: { share, requestId } }) => {
    const linkServer = requestServer.current;
    if (!requests.isCurrent(requestId) || !linkServer) {
      return;
    }
    const link = buildDeckShareLink(window.location.href, { token: share.token, ...linkServer });
    setState({ status: 'created', link, expiresAt: share.expiresAt, itemCount: share.itemCount, copied: false });
    void copyShareLink(link).then((copied) => {
      if (!requests.isCurrent(requestId)) {
        return;
      }
      requests.cancel();
      setState((current) => (current.status === 'created' && current.link === link ? { ...current, copied } : current));
    });
  }, server.Types.DECK_SHARE_CREATED, [requests]);

  useReduxEffect<SessionCommandFailedPayload>(({ payload: { command, responseCode, failure, requestId } }) => {
    if (command !== 'deckShareCreate' || !requests.isCurrent(requestId)) {
      return;
    }
    requests.cancel();
    setState({
      status: 'failed',
      message: describeFailure(failure, t('DeckSharing.createFailed', { code: responseCode })),
    });
  }, server.Types.SESSION_COMMAND_FAILED, [requests, describeFailure, t]);

  const create = (params: DeckShareCreateParams) => {
    if (state.status === 'pending') {
      return;
    }
    if (!shareServer) {
      setState({ status: 'failed', message: t('DeckSharing.noServer') });
      return;
    }
    requestServer.current = shareServer;
    setState({ status: 'pending' });
    webClient.request.session.deckShareCreate(params, requests.begin());
  };

  const reset = () => {
    requests.cancel();
    setState({ status: 'idle' });
  };

  return { state, create, reset };
}

export type VisibilityTarget = { deckId: number } | { folderPath: string };

export function useDeckVisibility() {
  const webClient = useWebClient();
  const { t } = useTranslation();
  const describeFailure = useCommandFailureMessage();
  const [error, setError] = useState<string | null>(null);

  useReduxEffect<SessionCommandFailedPayload>(({ payload: { command, responseCode, failure } }) => {
    if (command === 'deckSetVisibility') {
      setError(describeFailure(failure, t('DeckSharing.visibilityFailed', { code: responseCode })));
    }
  }, server.Types.SESSION_COMMAND_FAILED, [describeFailure, t]);

  const toggle = (target: VisibilityTarget, visibility: DeckVisibility) => {
    const params: DeckSetVisibilityParams = { ...target, isPublic: visibility !== 'public' };
    webClient.request.session.deckSetVisibility(params);
  };

  return { toggle, error, clearError: () => setError(null) };
}
