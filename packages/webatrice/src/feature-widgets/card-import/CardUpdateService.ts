import {
  cardDatabaseService,
  CardSourceId,
  MAX_DOWNLOAD_BYTES,
  MAX_METADATA_BYTES,
  MAX_SEASON_BYTES,
  type RebuildResult,
} from '@app/services';

export const UpstreamUrl = {
  TOKENS: 'https://raw.githubusercontent.com/Cockatrice/Magic-Token/master/tokens.xml',
  SPOILERS: 'https://raw.githubusercontent.com/Cockatrice/Magic-Spoiler/files/spoiler.xml',
  SPOILER_SEASON: 'https://raw.githubusercontent.com/Cockatrice/Magic-Spoiler/files/SpoilerSeasonEnabled',
  MTGJSON_META: 'https://www.mtgjson.com/api/v5/Meta.json',
} as const;

const FETCH_TIMEOUT_MS = 60_000;

export class UpdateFetchError extends Error {
  constructor(readonly url: string, readonly status?: number) {
    super(status ? `HTTP ${status}` : 'network');
    this.name = 'UpdateFetchError';
  }
}

async function readBoundedText(response: Response, maxBytes: number, signal: AbortSignal): Promise<string> {
  if (Number(response.headers.get('content-length')) > maxBytes) {
    void response.body?.cancel().catch(() => undefined);
    throw new Error('Card download exceeds the size limit');
  }
  if (!response.body) {
    return '';
  }
  const reader = response.body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        cancel();
        throw new Error('Card download exceeds the size limit');
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

async function fetchText(url: string, fetchImpl: typeof fetch, maxBytes: number): Promise<{ status: number; ok: boolean; text: string }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new UpdateFetchError(url));
      controller.abort();
    }, FETCH_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      timeout,
      (async () => {
        const response = await fetchImpl(url, { cache: 'no-cache', signal: controller.signal });
        if (!response.ok) {
          void response.body?.cancel().catch(() => undefined);
          return { status: response.status, ok: false, text: '' };
        }
        const text = await readBoundedText(response, maxBytes, controller.signal);
        return { status: response.status, ok: true, text };
      })(),
    ]);
  } catch {
    controller.abort();
    throw new UpdateFetchError(url);
  } finally {
    clearTimeout(timer);
  }
}

async function download(url: string, fetchImpl: typeof fetch, maxBytes = MAX_DOWNLOAD_BYTES): Promise<string> {
  const response = await fetchText(url, fetchImpl, maxBytes);
  if (!response.ok) {
    throw new UpdateFetchError(url, response.status);
  }
  return response.text;
}

export type SpoilerUpdateResult =
  | { status: 'season-ended'; removed: boolean; rebuild?: RebuildResult }
  | { status: 'up-to-date' }
  | { status: 'updated'; rebuild: RebuildResult };

export interface CardDatabaseVersionCheck {
  latestVersion?: string;
  installedVersion?: string;
  updateAvailable: boolean;
}

class CardUpdateService {
  constructor(private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init)) {}

  async updateTokens(): Promise<RebuildResult> {
    const xml = await download(UpstreamUrl.TOKENS, this.fetchImpl);
    return cardDatabaseService.addSources([
      { fileName: 'tokens.xml', kind: 'tokens', xml, origin: 'url', url: UpstreamUrl.TOKENS },
    ]);
  }

  async updateSpoilers(): Promise<SpoilerUpdateResult> {
    const season = await fetchText(UpstreamUrl.SPOILER_SEASON, this.fetchImpl, MAX_SEASON_BYTES);
    if (season.status === 404) {
      const sources = await cardDatabaseService.listSources();
      const hasSpoilers = sources.some((s) => s.id === CardSourceId.SPOILER);
      if (!hasSpoilers) {
        return { status: 'season-ended', removed: false };
      }
      return { status: 'season-ended', removed: true, rebuild: await cardDatabaseService.removeSource(CardSourceId.SPOILER) };
    }
    if (!season.ok) {
      throw new UpdateFetchError(UpstreamUrl.SPOILER_SEASON, season.status);
    }

    const xml = await download(UpstreamUrl.SPOILERS, this.fetchImpl);
    if (await cardDatabaseService.hasSourceXml(CardSourceId.SPOILER, xml)) {
      return { status: 'up-to-date' };
    }
    const rebuild = await cardDatabaseService.addSources([
      { fileName: 'spoiler.xml', kind: 'spoiler', xml, origin: 'url', url: UpstreamUrl.SPOILERS },
    ]);
    return { status: 'updated', rebuild };
  }

  async checkCardDatabase(): Promise<CardDatabaseVersionCheck> {
    const text = await download(UpstreamUrl.MTGJSON_META, this.fetchImpl, MAX_METADATA_BYTES);
    const meta = JSON.parse(text) as { data?: { version?: string }; meta?: { version?: string } };
    const latestVersion = meta.data?.version ?? meta.meta?.version;
    const sources = await cardDatabaseService.listSources();
    const installedVersion = sources.find((s) => s.kind === 'main' || s.kind === 'legacy')?.sourceVersion;
    await cardDatabaseService.recordUpdateCheck();
    return {
      latestVersion,
      installedVersion,
      updateAvailable: Boolean(latestVersion && latestVersion !== installedVersion),
    };
  }
}

export { CardUpdateService };
export const cardUpdateService = new CardUpdateService();
