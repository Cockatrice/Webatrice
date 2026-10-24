import { useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CircleAlert, Globe, Loader2, RefreshCw } from 'lucide-react';

import { Button, Chip, type ChipTone } from '@app/components';
import { CommanderSpellbookIntegration, type BracketAssessment } from '@app/types';

import { deckFingerprint, type UnavailableSource } from '../../bracket';
import { bracketSignalBadges, type SignalTone } from '../../bracketBadges';
import { lookupsAllowedFor, useBracketLookupsMode } from '../../bracketConsent';
import type { SourceFailure } from '../../bracketSources';
import { useBracketAssessment, type BracketAssessmentState } from '../../hooks/useBracketAssessment';
import type { DeckCard } from '../../types';

export interface BracketSectionProps {
  cards: DeckCard[];
  cachedAssessment?: BracketAssessment;
  onAssessmentComputed?: (assessment: BracketAssessment | undefined) => void;
}

export function BracketSection({ cards, cachedAssessment, onAssessmentComputed }: BracketSectionProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useBracketLookupsMode();
  const fingerprint = useMemo(() => deckFingerprint(cards), [cards]);
  const [requested, setRequested] = useState<string | null>(null);
  const lookupsAllowed = lookupsAllowedFor(mode, requested === fingerprint);
  const assessment = useBracketAssessment(cards, cachedAssessment, onAssessmentComputed, lookupsAllowed);
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={sectionRef} tabIndex={-1} aria-busy={assessment.status === 'loading'} className="outline-none">
      {assessment.status === 'consentRequired' ? (
        mode === CommanderSpellbookIntegration.Enabled
          ? (
            <Button size="sm" icon={<Globe size={13} />} onClick={() => setRequested(fingerprint)}>
              {t('DeckBracket.estimate')}
            </Button>
          )
          : <BracketConsentPrompt onChoose={setMode} />
      ) : assessment.status === 'loading' ? (
        <div className="flex items-center gap-2 text-[12px] text-text-muted">
          <Loader2 size={14} className="animate-spin" /> {t('DeckBracket.assessing')}
        </div>
      ) : assessment.status === 'error' ? (
        <div className="text-[12px] text-text-muted">
          {t('DeckBracket.failed', { message: assessment.message || t('DeckBracket.unknownError') })}
        </div>
      ) : (
        <BracketResult
          assessment={assessment}
          onRevokeLookups={mode === CommanderSpellbookIntegration.Enabled || mode === CommanderSpellbookIntegration.Automatic
            ? () => setMode(CommanderSpellbookIntegration.Unprompted)
            : undefined}
          onRetry={() => {
            sectionRef.current?.focus();
            assessment.retry();
          }}
        />
      )}
    </div>
  );
}

export const BRACKET_CHIP_TONE: Record<number, ChipTone> = { 1: 'success', 2: 'success', 3: 'warning', 4: 'danger', 5: 'danger' };

const SIGNAL_PILL: Record<SignalTone, string> = {
  muted: 'bg-bg-elevated text-text-muted',
  warn: 'bg-warning/15 text-warning',
  hot: 'bg-danger/15 text-danger',
};

function BracketResult({ assessment, onRetry, onRevokeLookups }: {
  assessment: Extract<BracketAssessmentState, { report: unknown }>;
  onRetry: () => void;
  onRevokeLookups?: () => void;
}) {
  const { t } = useTranslation();
  const [explain, setExplain] = useState(false);
  const { report } = assessment;
  const degraded = assessment.status === 'degraded';
  const badges = bracketSignalBadges(report.signals);
  const label = t(`DeckBracket.level.${report.level}`);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          tone={BRACKET_CHIP_TONE[report.level] ?? 'neutral'}
          title={t(degraded ? 'DeckBracket.partialTitle' : 'DeckBracket.title', { level: report.level, label })}
        >
          {t('DeckBracket.bracket')} <span className="tabular-nums">{degraded ? `${report.level}+` : report.level}</span> · {label}
        </Chip>
        <span className="text-[11.5px] text-text-muted">
          {t(degraded ? 'DeckBracket.partialEstimate' : 'DeckBracket.estimateNote')}
        </span>
      </div>

      {degraded && <BracketDegradedNotice unavailable={assessment.unavailable} onRetry={onRetry} />}

      <ul className="flex flex-col gap-y-1">
        {badges.map((badge) => {
          const items = badge.chainable?.length
            ? [...badge.items, t('DeckBracket.chainable'), ...badge.chainable]
            : badge.items;
          return (
            <li
              key={badge.id}
              className="flex min-w-0 items-center gap-2 text-[12px]"
              title={items.join(', ') || undefined}
            >
              <span
                className={[
                  'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1',
                  'text-[10.5px] font-semibold tabular-nums',
                  SIGNAL_PILL[badge.tone],
                ].join(' ')}
              >
                {badge.count}
              </span>
              <span className={badge.count ? 'shrink-0 text-text-primary' : 'shrink-0 text-text-muted'}>
                {t(`DeckBracket.signal.${badge.id}`)}
              </span>
              {items.length > 0 && <span className="truncate text-text-muted">· {items.join(', ')}</span>}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        aria-expanded={explain}
        onClick={() => setExplain((open) => !open)}
        className={[
          'w-fit text-[12px] font-medium text-accent hover:underline',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
        ].join(' ')}
      >
        {t('DeckBracket.why')}
      </button>
      {explain && (
        <div className="flex flex-col gap-1 text-[11.5px] leading-snug text-text-muted">
          <p>
            <Trans
              i18nKey="DeckBracket.methodology"
              components={[
                <a
                  key="edhpowerlevel"
                  href="https://edhpowerlevel.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-text-primary"
                />,
              ]}
            />
          </p>
          <p>
            {t('DeckBracket.provenance')}
            {onRevokeLookups && (
              <>
                {' '}
                <button type="button" onClick={onRevokeLookups} className="underline hover:text-text-primary">
                  {t('DeckBracket.consent.revoke')}
                </button>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function BracketConsentPrompt({ onChoose }: { onChoose: (mode: CommanderSpellbookIntegration) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] leading-snug text-text-muted">{t('DeckBracket.consent.prompt')}</p>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" icon={<Globe size={13} />} onClick={() => onChoose(CommanderSpellbookIntegration.Enabled)}>
          {t('DeckBracket.consent.enable')}
        </Button>
        <Button size="sm" onClick={() => onChoose(CommanderSpellbookIntegration.Automatic)}>
          {t('DeckBracket.consent.automatic')}
        </Button>
        <Button size="sm" onClick={() => onChoose(CommanderSpellbookIntegration.Disabled)}>
          {t('DeckBracket.consent.disable')}
        </Button>
      </div>
    </div>
  );
}

const FAILURE_KEY: Record<SourceFailure['kind'], string> = {
  timeout: 'DeckBracket.failure.timeout',
  network: 'DeckBracket.failure.network',
  http: 'DeckBracket.failure.http',
  malformed: 'DeckBracket.failure.malformed',
};

function BracketDegradedNotice({ unavailable, onRetry }: {
  unavailable: UnavailableSource[];
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-ui border border-warning/30 bg-warning/10 px-2.5 py-2 text-[11.5px] text-warning"
    >
      <CircleAlert size={14} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div>{t('DeckBracket.partialNotice')}</div>
        <ul className="mt-1 text-text-muted">
          {unavailable.map(({ source, failure, missing, total }) => {
            const params = {
              source: t(`DeckBracket.source.${source}`),
              reason: t(FAILURE_KEY[failure.kind], failure.kind === 'http' ? { status: failure.status } : {}),
            };
            return (
              <li key={source}>
                {missing != null
                  ? t('DeckBracket.sourcePartial', { ...params, missing, total })
                  : t('DeckBracket.sourceUnavailable', params)}
              </li>
            );
          })}
        </ul>
      </div>
      <Button size="sm" variant="ghost" className="!text-warning hover:!bg-warning/10" icon={<RefreshCw size={11} />} onClick={onRetry}>
        {t('DeckBracket.retry')}
      </Button>
    </div>
  );
}
