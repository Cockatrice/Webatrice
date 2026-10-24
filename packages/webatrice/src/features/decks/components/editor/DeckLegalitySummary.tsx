import { useTranslation } from 'react-i18next';
import { Ban, CircleCheck, CircleHelp, Loader2 } from 'lucide-react';

import { Chip } from '@app/components';

import { formatDisplayLabel } from '../../deckSummary';
import type { DeckLegalityStatus } from '../../deckLegality';

export interface DeckLegalitySummaryProps {
  format: string;
  status: DeckLegalityStatus;
  illegalCount: number;
  unknownCount: number;
  loading: boolean;
}

export function DeckLegalitySummary({ format, status, illegalCount, unknownCount, loading }: DeckLegalitySummaryProps) {
  const { t } = useTranslation();
  if (status === 'none' && !loading) {
    return null;
  }
  const formatLabel = formatDisplayLabel(format, t);
  const unchecked = !loading && status !== 'unavailable' && unknownCount > 0
    ? t('DeckLegality.unchecked', { count: unknownCount })
    : undefined;

  let chip;
  if (loading) {
    chip = <Chip icon={<Loader2 size={12} className="animate-spin" />}>{t('DeckLegality.checking')}</Chip>;
  } else if (status === 'unavailable') {
    chip = <Chip icon={<CircleHelp size={12} />}>{t('DeckLegality.unavailable', { format: formatLabel })}</Chip>;
  } else if (status === 'illegal') {
    chip = (
      <Chip tone="danger" icon={<Ban size={12} />} title={unchecked}>
        {t('DeckLegality.illegal', { count: illegalCount, format: formatLabel })}
      </Chip>
    );
  } else {
    chip = (
      <Chip tone="success" icon={<CircleCheck size={12} />} title={unchecked}>
        {t('DeckLegality.legal', { format: formatLabel })}
      </Chip>
    );
  }

  return (
    <span role="status" className="inline-flex items-center gap-1.5">
      {chip}
      {unchecked && <span className="text-[11px] text-text-muted">{unchecked}</span>}
    </span>
  );
}
