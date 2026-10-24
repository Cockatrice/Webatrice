import type { ReactNode } from 'react';

export default function HomeEmpty({ icon, children, actions }: { icon: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-ui-lg border border-dashed border-border-strong px-pad py-4">
      <div className="flex min-w-0 flex-1 basis-[280px] items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-text-secondary" aria-hidden>
          {icon}
        </span>
        <p className="min-w-0 text-[13px] leading-snug text-text-secondary">{children}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
