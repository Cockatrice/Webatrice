import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import type { ColorScheme } from '@app/services';
import type { ThemeName } from '@app/types';
import { cx } from '@app/utils';

import { previewVars } from './themePreview';

function MiniApp({ themeName, shade }: { themeName: ThemeName; shade: ColorScheme }) {
  return (
    <span aria-hidden style={previewVars(themeName, shade)} className="absolute inset-0 flex bg-bg-base">
      <span className="w-[18%] border-r border-border-subtle bg-bg-surface p-1.5">
        <span className="mb-1.5 block h-2.5 w-2.5 rounded-sm bg-accent" />
        <span className="mb-1 block h-1.5 rounded-full bg-accent/60" />
        <span className="mb-1 block h-1.5 rounded-full bg-text-muted/40" />
        <span className="block h-1.5 rounded-full bg-text-muted/40" />
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="block h-2 w-1/2 rounded-full bg-text-primary/70" />
        <span className="flex flex-1 gap-1.5">
          <span className="flex-1 rounded-[3px] border border-border-subtle bg-bg-surface p-1">
            <span className="mb-1 block h-1.5 w-3/4 rounded-full bg-text-secondary/50" />
            <span className="block h-1.5 w-1/2 rounded-full bg-text-muted/40" />
          </span>
          <span className="flex-1 rounded-[3px] border border-border-subtle bg-bg-surface p-1">
            <span className="mb-1 block h-1.5 w-2/3 rounded-full bg-text-secondary/50" />
            <span className="ml-auto mt-2 block h-2.5 w-1/2 rounded-[2px] bg-accent" />
          </span>
        </span>
      </span>
    </span>
  );
}

export function ThemePreview({ themeName, shade }: { themeName: ThemeName; shade: ColorScheme | 'split' }) {
  return (
    <span className="relative block h-[68px] w-[124px] overflow-hidden rounded-ui">
      {shade === 'split' ? (
        <>
          <MiniApp themeName={themeName} shade="light" />
          <span className="absolute inset-0 [clip-path:polygon(58%_0,100%_0,100%_100%,42%_100%)]">
            <MiniApp themeName={themeName} shade="dark" />
          </span>
        </>
      ) : (
        <MiniApp themeName={themeName} shade={shade} />
      )}
    </span>
  );
}

interface ThemeTileProps {
  id?: string;
  name: string;
  value: string;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
  icon?: LucideIcon;
  label: string;
  preview: ReactNode;
}

export function ThemeTile({ id, name, value, checked, disabled, onSelect, icon: Icon, label, preview }: ThemeTileProps) {
  return (
    <label className={cx('group relative', disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer')}>
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        className={cx(
          'flex flex-col gap-1.5 rounded-ui-lg border p-1.5 transition-colors',
          'peer-focus-visible:outline peer-focus-visible:outline-2',
          'peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          checked ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-border-subtle group-hover:border-border-strong',
        )}
      >
        {preview}
        <span className="flex items-center gap-1.5 px-0.5 text-[12px] font-medium text-text-primary">
          {Icon && <Icon size={13} aria-hidden className={checked ? 'text-accent' : 'text-text-muted'} />}
          {label}
          <span
            aria-hidden
            className={cx(
              'ml-auto h-3.5 w-3.5 rounded-full border-2',
              checked ? 'border-accent bg-accent shadow-[inset_0_0_0_2px_rgb(var(--bg-surface))]' : 'border-border-control',
            )}
          />
        </span>
      </span>
    </label>
  );
}
