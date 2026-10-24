import { useId, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Avatar, VirtualRows } from '@app/components';
import { useElementWidth } from '@app/hooks';
import { cx } from '@app/utils';

import { chunkRows, gridColumns } from './peopleGrid';
import type { PersonRow } from './peopleGroups';

export const GRID_ROW_PX = 36;
export const GRID_VISIBLE_ROWS = 10;

export function FacePile({ people }: { people: PersonRow[] }) {
  const { t } = useTranslation();
  if (people.length === 0) {
    return null;
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex shrink-0 -space-x-1.5" aria-hidden>
        {people.slice(0, 5).map((person) => (
          <span key={person.name} className="rounded-full ring-2 ring-bg-surface"><Avatar name={person.name} size={22} /></span>
        ))}
      </span>
      <span className="truncate text-[12px] text-text-muted">
        {t('People.section.preview', {
          count: people.length,
          first: people[0]?.name,
          second: people[1]?.name,
          more: Math.max(0, people.length - 2),
        })}
      </span>
    </span>
  );
}

export function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  preview,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  preview?: ReactNode;
  children: ReactNode;
}) {
  const bodyId = useId();
  return (
    <section aria-label={title} className="rounded-ui-lg border border-border-subtle bg-bg-surface">
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className={cx(
            'flex w-full flex-col items-start gap-1 rounded-ui-lg px-4 py-2.5 text-left hover:bg-bg-elevated/50',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
          )}
        >
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
            <span>{title}</span>
            <span className="tabular-nums">· {count}</span>
          </span>
          {!open && preview && <span className="block w-full pl-5">{preview}</span>}
        </button>
      </h2>
      <div id={bodyId} hidden={!open} className="px-2 pb-2">
        {open && children}
      </div>
    </section>
  );
}

export function PeopleGrid({
  people,
  label,
  renderPerson,
}: {
  people: PersonRow[];
  label: string;
  renderPerson: (person: PersonRow) => ReactNode;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const columns = gridColumns(width, people.length);
  const rows = useMemo(() => chunkRows(people, columns), [people, columns]);
  const height = Math.min(rows.length, GRID_VISIBLE_ROWS) * GRID_ROW_PX;
  return (
    <div ref={ref} role="list" aria-label={label} style={{ height }}>
      <VirtualRows
        items={rows}
        rowHeight={GRID_ROW_PX}
        role="presentation"
        renderRow={(row, _index, style) => (
          <div style={{ ...style, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} className="grid gap-x-2">
            {row.map((person) => (
              <div key={person.name} role="listitem" className="min-w-0">
                {renderPerson(person)}
              </div>
            ))}
          </div>
        )}
      />
    </div>
  );
}
