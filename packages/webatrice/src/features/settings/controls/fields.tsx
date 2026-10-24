import { type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

import { cx } from '@app/utils';

export const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const fieldBox = cx(
  'h-9 rounded-ui border border-border-control bg-bg-sunken text-[13px] text-text-primary',
  'hover:border-border-control disabled:cursor-not-allowed disabled:opacity-45',
  'aria-[invalid=true]:border-danger',
  focusRing,
);

export const textField = cx(fieldBox, 'w-56 px-2.5 placeholder:text-text-muted');

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Switch({ checked, onChange, className, disabled, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-[22px] w-10 shrink-0 rounded-full transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-45',
        checked ? 'bg-accent' : 'bg-bg-elevated ring-1 ring-inset ring-border-control',
        focusRing,
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cx(
          'absolute top-[3px] h-4 w-4 rounded-full shadow transition-all',
          checked ? 'left-[21px] bg-on-accent' : 'left-[3px] bg-text-muted',
        )}
      />
    </button>
  );
}

interface SelectBoxProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
  wrapperClassName?: string;
}

export function SelectBox({ children, className, wrapperClassName, ...rest }: SelectBoxProps) {
  return (
    <span className={cx('relative inline-flex min-w-[180px] max-w-full items-center', wrapperClassName)}>
      <select className={cx(fieldBox, 'w-full cursor-pointer appearance-none truncate pl-3 pr-8', className)} {...rest}>
        {children}
      </select>
      <ChevronDown size={15} aria-hidden className="pointer-events-none absolute right-2.5 text-text-muted" />
    </span>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return <span role="alert" className="text-[12px] text-danger">{children}</span>;
}
