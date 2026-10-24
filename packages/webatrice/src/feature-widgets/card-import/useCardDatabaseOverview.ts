import { useCallback, useEffect, useState } from 'react';

import { useImportSummaryText } from '@app/hooks';
import {
  cardDatabaseService,
  importCustomSetFiles,
  type CardDatabaseSummary,
  type CardSource,
  type RebuildResult,
  type UnknownSetsAnswer,
} from '@app/services';

import { cardUpdateService, UpdateFetchError } from './CardUpdateService';

export type OverviewAction = 'reload' | 'addCustom' | 'remove' | 'tokens' | 'spoilers' | 'checkCards';

export type OverviewSeverity = 'success' | 'info' | 'warning' | 'error';

export type OverviewMessage =
  | { severity: OverviewSeverity; key: string; params?: Record<string, string | number> }
  | { severity: OverviewSeverity; text: string };

export interface CardDatabaseOverview {
  loading: boolean;
  busy: OverviewAction | null;
  sources: CardSource[];
  summary: CardDatabaseSummary | null;
  lastUpdateCheck?: string;
  message: OverviewMessage | null;
  unknownSets: string[];
  reload: () => Promise<void>;
  addCustomFiles: (files: File[]) => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  updateTokens: () => Promise<void>;
  updateSpoilers: () => Promise<void>;
  checkCardDatabase: () => Promise<void>;
  answerUnknownSets: (answer: UnknownSetsAnswer) => Promise<void>;
  showUnknownSets: (codes: string[]) => void;
}

function isRebuild(outcome: OverviewMessage | RebuildResult | null): outcome is RebuildResult {
  return outcome !== null && 'summary' in outcome;
}

function errorMessage(e: unknown): OverviewMessage {
  if (e instanceof UpdateFetchError) {
    return e.status
      ? { severity: 'error', key: 'httpError', params: { status: e.status, url: e.url } }
      : { severity: 'error', key: 'offline', params: { url: e.url } };
  }
  return { severity: 'error', key: 'failed', params: { error: (e as Error).message } };
}

export function useCardDatabaseOverview(): CardDatabaseOverview {
  const summaryText = useImportSummaryText();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<OverviewAction | null>(null);
  const [sources, setSources] = useState<CardSource[]>([]);
  const [summary, setSummary] = useState<CardDatabaseSummary | null>(null);
  const [lastUpdateCheck, setLastUpdateCheck] = useState<string>();
  const [message, setMessage] = useState<OverviewMessage | null>(null);
  const [unknownSets, setUnknownSets] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const [nextSources, nextSummary, nextCheck] = await Promise.all([
      cardDatabaseService.listSources(),
      cardDatabaseService.summary(),
      cardDatabaseService.getLastUpdateCheck(),
    ]);
    setSources(nextSources);
    setSummary(nextSummary);
    setLastUpdateCheck(nextCheck);
  }, []);

  useEffect(() => {
    refresh().catch((e) => setMessage(errorMessage(e))).finally(() => setLoading(false));
  }, [refresh]);

  const run = async (action: OverviewAction, work: () => Promise<OverviewMessage | RebuildResult | null>) => {
    setBusy(action);
    setMessage(null);
    try {
      const outcome = await work();
      if (isRebuild(outcome)) {
        setUnknownSets(outcome.unknownSets);
        setMessage(outcome.allNewSetsEnabled
          ? { severity: 'info', key: 'allSetsEnabled' }
          : { severity: 'success', key: 'reloaded', params: { ...outcome.summary } });
      } else {
        setMessage(outcome);
      }
      await refresh();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return {
    loading,
    busy,
    sources,
    summary,
    lastUpdateCheck,
    message,
    unknownSets,
    reload: () => run('reload', () => cardDatabaseService.reload()),
    addCustomFiles: (files) => run('addCustom', async () => {
      const summary = await importCustomSetFiles(files);
      setUnknownSets(summary.unknownSets);
      const text = summaryText(summary, 'cardFiles');
      return {
        severity: text.severity === 'warning' ? 'warning' : 'success',
        text: [text.headline, ...text.problems].join(' '),
      };
    }),
    removeSource: (id) => run('remove', () => cardDatabaseService.removeSource(id)),
    updateTokens: () => run('tokens', () => cardUpdateService.updateTokens()),
    updateSpoilers: () => run('spoilers', async () => {
      const result = await cardUpdateService.updateSpoilers();
      switch (result.status) {
        case 'updated': return result.rebuild;
        case 'up-to-date': return { severity: 'info', key: 'spoilersUpToDate' };
        case 'season-ended': return { severity: 'info', key: result.removed ? 'spoilerSeasonEndedRemoved' : 'spoilerSeasonEnded' };
      }
    }),
    checkCardDatabase: () => run('checkCards', async () => {
      const check = await cardUpdateService.checkCardDatabase();
      return check.updateAvailable
        ? {
          severity: 'info',
          key: 'cardUpdateAvailable',
          params: { latest: check.latestVersion ?? '', installed: check.installedVersion ?? '—' },
        }
        : { severity: 'success', key: 'cardsUpToDate', params: { version: check.latestVersion ?? '' } };
    }),
    answerUnknownSets: async (answer) => {
      try {
        await cardDatabaseService.resolveUnknownSets(answer);
        setUnknownSets([]);
      } catch (e) {
        setMessage(errorMessage(e));
      }
    },
    showUnknownSets: setUnknownSets,
  };
}
