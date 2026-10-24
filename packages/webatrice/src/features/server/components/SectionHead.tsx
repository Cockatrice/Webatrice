import type { ReactNode } from 'react';

export default function SectionHead({ id, title, count, action }: { id: string; title: string; count?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-7 items-baseline gap-2">
      <h2 id={id} className="font-display text-[16px] font-semibold text-text-primary">{title}</h2>
      {count !== undefined && <span className="truncate text-[12px] text-text-muted">{count}</span>}
      <span className="ml-auto shrink-0">{action}</span>
    </div>
  );
}
