import type { ReactNode } from 'react';

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-w-0 flex-col rounded-ui border border-border-subtle bg-bg-base/40 px-2 py-1.5">
      <span className="font-display text-[16px] font-semibold leading-tight tabular-nums text-text-primary">{value}</span>
      <span className="truncate text-[11px] text-text-muted">{label}</span>
    </div>
  );
}

export function SectionHeader({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">{children}</h3>
      {actions && <div className="ml-auto">{actions}</div>}
    </div>
  );
}
