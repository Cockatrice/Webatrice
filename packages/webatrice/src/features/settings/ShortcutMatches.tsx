import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { Button, Kbd } from '@app/components';
import { toMenuShortcut } from '@app/feature-widgets/shortcuts';
import type { RouteEnum } from '@app/types';

import Highlight from './Highlight';
import { shortcutCount, type ShortcutHit } from './searchSettings';

const SHOWN = 12;

interface ShortcutMatchesProps {
  page: RouteEnum;
  query: string;
  hits: readonly ShortcutHit[];
  searching: boolean;
}

function Keys({ sequence }: { sequence: string }) {
  return <Kbd>{toMenuShortcut([sequence], false).shortcut}</Kbd>;
}

export default function ShortcutMatches({ page, query, hits, searching }: ShortcutMatchesProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = (
    <Button size="sm" iconRight={<ArrowRight size={13} aria-hidden />} onClick={() => navigate(page)}>
      {t('Settings.shortcuts.open')}
    </Button>
  );

  if (!searching || hits.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-pad py-[calc(var(--pad)*0.75)]">
        <p className="min-w-[16rem] flex-1 text-[13px] text-text-secondary">
          {t('Settings.shortcuts.summary', { count: shortcutCount })}
        </p>
        {open}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <ul aria-label={t('Settings.shortcuts.matches', { count: hits.length })} className="divide-y divide-border-subtle">
        {hits.slice(0, SHOWN).map((hit) => (
          <li key={hit.actionId} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-pad py-2">
            <span className="flex min-w-[16rem] flex-1 flex-col">
              <span className="text-[13px] font-medium text-text-primary">
                <Highlight text={t(`ShortcutsTab.action.${hit.actionId}`)} query={query} />
              </span>
              <span className="text-[12px] text-text-muted">
                <Highlight text={t(`ShortcutsTab.group.${hit.groupId}`)} query={query} />
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {hit.sequences.length === 0
                ? <span className="text-[12px] text-text-muted">{t('Settings.shortcuts.unbound')}</span>
                : hit.sequences.map((sequence) => <Keys key={sequence} sequence={sequence} />)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle px-pad py-2.5">
        {hits.length > SHOWN && (
          <span className="text-[12px] text-text-muted">{t('Settings.shortcuts.more', { count: hits.length - SHOWN })}</span>
        )}
        <span className="ml-auto">{open}</span>
      </div>
    </div>
  );
}
