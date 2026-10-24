import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { CommanderSpellbookIntegration, isCommanderFormat, type BracketAssessment } from '@app/types';

import { useBracketLookupsMode } from '../../bracketConsent';
import { computeDeckStats } from '../../deckStats';
import type { DeckCard } from '../../types';
import { BracketSection } from './BracketSection';
import { SectionHeader, StatCard } from './BreakdownBlocks';
import { ColorBar } from './ColorBar';
import { ManaCurve } from './ManaCurve';
import { TypeBreakdown } from './TypeBreakdown';

export function DeckBreakdown({
  cards,
  format,
  cachedAssessment,
  onAssessmentComputed,
}: {
  cards: DeckCard[];
  format: string;
  cachedAssessment?: BracketAssessment;
  onAssessmentComputed?: (assessment: BracketAssessment | undefined) => void;
}) {
  const { t } = useTranslation();
  const stats = useMemo(() => computeDeckStats(cards), [cards]);
  const [bracketMode] = useBracketLookupsMode();
  const showBracket = isCommanderFormat(format) && stats.totalCards > 0
    && bracketMode !== CommanderSpellbookIntegration.Disabled;

  if (stats.totalCards === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-1.5">
        <StatCard label={t('DeckBreakdown.stat.total')} value={stats.totalCards} />
        <StatCard label={t('DeckBreakdown.stat.nonland')} value={stats.nonlandCards} />
        <StatCard label={t('DeckBreakdown.stat.lands')} value={stats.landCount} />
        <StatCard label={t('DeckBreakdown.stat.avgCmc')} value={stats.avgNonlandCmc.toFixed(2)} />
      </div>

      <section>
        <SectionHeader>{t('DeckBreakdown.manaCurve')}</SectionHeader>
        <ManaCurve curve={stats.curve} />
      </section>

      <section>
        <SectionHeader>{t('DeckBreakdown.colorDistribution')}</SectionHeader>
        <ColorBar pips={stats.pips} />
      </section>

      <section>
        <SectionHeader>{t('DeckBreakdown.cardTypes')}</SectionHeader>
        <TypeBreakdown counts={stats.typeCounts} />
      </section>

      {showBracket && (
        <section className="rounded-ui border border-border-subtle p-2.5">
          <SectionHeader>{t('DeckBreakdown.bracketEstimate')}</SectionHeader>
          <BracketSection
            cards={cards}
            cachedAssessment={cachedAssessment}
            onAssessmentComputed={onAssessmentComputed}
          />
        </section>
      )}
    </div>
  );
}
