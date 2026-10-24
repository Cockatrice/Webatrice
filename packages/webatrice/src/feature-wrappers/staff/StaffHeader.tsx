import { useRef, type KeyboardEvent, type ReactNode } from 'react';

import { cx } from '@app/utils';

import { focusRing } from './staffStyles';
import { staffTabIds, tabKeyTarget } from './staffTabs';

interface StaffHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function StaffHeader({ title, subtitle, actions }: StaffHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 px-5 pb-3 pt-4">
      <div className="flex min-w-0 flex-col">
        <h1 className="font-display text-[20px] font-semibold leading-tight text-text-primary">{title}</h1>
        {subtitle && <div className="text-[12px] tabular-nums text-text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export interface StaffTabItem<T extends string> {
  value: T;
  label: string;
  count?: number | null;
}

interface StaffTabsProps<T extends string> {
  label: string;
  items: StaffTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  tabsId?: string;
}

export function StaffTabs<T extends string>({ label, items, value, onChange, tabsId }: StaffTabsProps<T>) {
  const tabs = tabsId !== undefined;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = tabKeyTarget(event.key, index, items.length);
    if (!tabs || target === null) {
      return;
    }
    event.preventDefault();
    onChange(items[target].value);
    buttons.current[target]?.focus();
  };

  return (
    <div
      role={tabs ? 'tablist' : 'group'}
      aria-label={label}
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border-subtle px-5"
    >
      {items.map((item, index) => (
        <button
          key={item.value}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          type="button"
          role={tabs ? 'tab' : undefined}
          id={tabs ? staffTabIds(tabsId, item.value).tab : undefined}
          aria-selected={tabs ? item.value === value : undefined}
          aria-controls={tabs ? staffTabIds(tabsId, item.value).panel : undefined}
          aria-pressed={tabs ? undefined : item.value === value}
          tabIndex={tabs ? (item.value === value ? 0 : -1) : undefined}
          onKeyDown={(event) => onKeyDown(event, index)}
          onClick={() => onChange(item.value)}
          className={cx(
            '-mb-px inline-flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium',
            item.value === value ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary',
            focusRing,
          )}
        >
          {item.label}
          {item.count != null && <span className="font-mono text-[11px] tabular-nums text-text-muted">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
