import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import { useCommandFailureMessage } from '@app/hooks';
import { useAppSelector } from '@app/store';

import {
  buildReplayItems,
  filterReplayItems,
  groupByDay,
  sourceCounts,
  type DayGroupItems,
  type LibraryGame,
  type ReplayItem,
  type ReplaySource,
} from './replayLibrary';
import { useLocalLibrary, type LocalLibrary } from './useLocalLibrary';
import { connectedEndpoint, type PreviewSource } from './useReplayPreview';
import { useServerReplays, type ServerReplays } from './useServerReplays';

export interface ReplayLibrary {
  server: ServerReplays;
  local: LocalLibrary;
  items: ReplayItem[];
  visible: ReplayItem[];
  groups: DayGroupItems[];
  counts: Record<ReplaySource, number>;
  source: ReplaySource;
  setSource: (source: ReplaySource) => void;
  query: string;
  setQuery: (query: string) => void;
  selected: ReplayItem | null;
  select: (id: string | null) => void;
  gameIndex: number;
  setGameIndex: (index: number) => void;
  selectedGame: LibraryGame | undefined;
  previewSource: PreviewSource | undefined;
  countries: Record<string, string>;
  now: number;
}

export function useReplayLibrary(): ReplayLibrary {
  const { t } = useTranslation();
  const webClient = useWebClient();
  const describeFailure = useCommandFailureMessage();
  const serverReplays = useServerReplays();
  const local = useLocalLibrary(serverReplays.librarySaves);
  const users = useAppSelector(server.Selectors.getUsers);
  const buddies = useAppSelector(server.Selectors.getBuddyList);

  const [source, setSource] = useState<ReplaySource>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gameIndex, setGameIndex] = useState(0);
  const [now] = useState(() => Date.now());

  const endpoint = connectedEndpoint(webClient);
  const items = useMemo(
    () => buildReplayItems(serverReplays.matches, local.entries, endpoint),
    [serverReplays.matches, local.entries, endpoint],
  );
  const visible = useMemo(() => filterReplayItems(items, source, query), [items, source, query]);
  const groups = useMemo(() => groupByDay(visible, now), [visible, now]);
  const counts = useMemo(() => sourceCounts(items), [items]);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  useEffect(() => {
    if (selectedId && !selected) {
      setSelectedId(null);
    }
  }, [selectedId, selected]);

  const { select: selectServer } = serverReplays;
  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setGameIndex(0);
    const item = items.find((candidate) => candidate.id === id);
    selectServer(item?.kind === 'match' ? { kind: 'match', gameId: item.gameId } : null);
  }, [items, selectServer]);

  const selectedGame = selected?.kind === 'match' ? selected.games[Math.min(gameIndex, selected.games.length - 1)] : undefined;

  const downloadReplay = useCallback((replayId: number) => new Promise<Uint8Array>((resolve, reject) => {
    webClient.request.session.replayDownload(
      replayId,
      resolve,
      (_responseCode, failure) => reject(new Error(describeFailure(failure, t('Replays.server.downloadFailed')))),
    );
  }), [webClient, describeFailure, t]);

  const { readEntry } = local;
  const previewSource = useMemo<PreviewSource | undefined>(() => {
    if (!selected) {
      return undefined;
    }
    if (selected.kind === 'file') {
      return { key: `file:${selected.entryId}`, title: selected.name, fetch: () => readEntry(selected.entryId) };
    }
    if (!selectedGame) {
      return undefined;
    }
    const { replayId, localEntryId } = selectedGame;
    return {
      key: `server:${replayId}`,
      title: t('Replays.server.matchReplayTitle', { name: selected.name, id: replayId }),
      fetch: () => (localEntryId != null ? readEntry(localEntryId) : downloadReplay(replayId)),
    };
  }, [selected, selectedGame, readEntry, downloadReplay, t]);

  const countries = useMemo(() => {
    const map: Record<string, string> = {};
    for (const user of [...Object.values(buddies), ...Object.values(users)]) {
      if (user.country) {
        map[user.name] = user.country;
      }
    }
    return map;
  }, [users, buddies]);

  return {
    server: serverReplays,
    local,
    items,
    visible,
    groups,
    counts,
    source,
    setSource,
    query,
    setQuery,
    selected,
    select,
    gameIndex,
    setGameIndex,
    selectedGame,
    previewSource,
    countries,
    now,
  };
}
