import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Lock, LockOpen } from 'lucide-react';

import { AuthGuard, Button } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';
import { cx } from '@app/utils';

import { focusRing } from './staffStyles';
import type { StaffToolId } from './staffTools';
import { useStaffConsole } from './useStaffConsole';

const TOOL_LABEL_KEYS: Record<StaffToolId, string> = {
  reports: 'Staff.tool.reports',
  moderation: 'Staff.tool.moderation',
  logs: 'Staff.tool.logs',
  administration: 'Staff.tool.administration',
  cardArtRules: 'Staff.tool.cardArtRules',
  developer: 'Staff.tool.developer',
};

function StaffLockCard({ locked, onChange }: { locked: boolean; onChange: (locked: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t('Staff.lock.region')}
      className={cx(
        'mt-auto flex flex-col gap-2 rounded-ui-lg border p-3',
        locked ? 'border-border-subtle bg-bg-base/50' : 'border-danger/50 bg-danger/10',
      )}
    >
      <span className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
        {locked ? <Lock size={14} className="text-text-muted" aria-hidden /> : <LockOpen size={14} className="text-danger" aria-hidden />}
        {locked ? t('Staff.lock.locked') : t('Staff.lock.unlocked')}
      </span>
      <span className="text-[11px] leading-snug text-text-muted">
        {locked ? t('Staff.lock.lockedHint') : t('Staff.lock.unlockedHint')}
      </span>
      <Button
        size="sm"
        variant={locked ? 'secondary' : 'danger'}
        onClick={() => onChange(!locked)}
        icon={locked ? <LockOpen size={13} aria-hidden /> : <Lock size={13} aria-hidden />}
      >
        {locked ? t('Staff.lock.unlock') : t('Staff.lock.lock')}
      </Button>
    </section>
  );
}

function StaffNav() {
  const { t } = useTranslation();
  const staff = useStaffConsole();

  return (
    <nav
      aria-label={t('Staff.nav')}
      className="flex w-[216px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border-subtle bg-bg-surface p-3"
    >
      <span className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {t('Staff.nav')}
      </span>
      {staff.tools.map(({ tool, available }) => {
        const active = tool.id === staff.activeId;
        const Icon = tool.icon;
        if (!available) {
          return (
            <div
              key={tool.id}
              aria-disabled="true"
              className="flex shrink-0 items-start gap-2.5 rounded-ui px-2.5 py-2 text-[13px] font-medium text-text-disabled"
            >
              <Icon size={15} aria-hidden className="mt-px shrink-0" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{t(TOOL_LABEL_KEYS[tool.id])}</span>
                <span className="text-[11px] font-normal text-text-muted">{t('Staff.needsServer')}</span>
              </span>
            </div>
          );
        }
        const badge = tool.id === 'reports' && staff.unresolvedReports ? staff.unresolvedReports : null;
        return (
          <Link
            key={tool.id}
            to={tool.route}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex h-9 shrink-0 items-center gap-2.5 rounded-ui px-2.5 text-[13px] font-medium',
              active ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
              focusRing,
            )}
          >
            <Icon size={15} aria-hidden />
            <span className="flex-1 truncate">{t(TOOL_LABEL_KEYS[tool.id])}</span>
            {badge !== null && (
              <span
                className="rounded-full bg-warning/20 px-1.5 font-mono text-[11px] tabular-nums text-warning"
                aria-label={t('Staff.unresolvedBadge', { count: badge })}
              >
                {badge}
              </span>
            )}
            {tool.lockable && staff.locked && <Lock size={12} className="text-text-muted" aria-label={t('Staff.lock.lockedIcon')} />}
          </Link>
        );
      })}
      {staff.showLock && <StaffLockCard locked={staff.locked} onChange={staff.setLocked} />}
    </nav>
  );
}

export default function StaffConsole({ children }: { children: ReactNode }) {
  return (
    <Layout>
      <AuthGuard />
      <div className="flex h-full min-h-0 bg-bg-base">
        <StaffNav />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </Layout>
  );
}
