import type { ChangeEvent, FocusEvent, Ref } from 'react';
import { Check } from 'lucide-react';

import { cx } from '@app/utils';

interface LoginCheckboxProps {
  value: boolean | undefined;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  name?: string;
  label: string;
  disabled?: boolean;
  ref?: Ref<HTMLInputElement>;
}

const LoginCheckbox = ({ value, onChange, onBlur, name, label, disabled, ref }: LoginCheckboxProps) => {
  const checked = Boolean(value);
  return (
    <label
      className={cx(
        'inline-flex select-none items-center gap-2 text-[13px] text-text-primary',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
    >
      <span className="relative inline-flex shrink-0">
        <input
          ref={ref}
          type="checkbox"
          name={name}
          checked={checked}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cx(
            'flex h-4 w-4 items-center justify-center rounded-[3px] border transition-colors',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2',
            'peer-focus-visible:ring-offset-bg-surface',
            checked ? 'border-accent bg-accent' : 'border-border-control bg-bg-sunken',
          )}
        >
          {checked && <Check size={11} strokeWidth={3} className="text-on-accent" />}
        </span>
      </span>
      {label}
    </label>
  );
};

export default LoginCheckbox;
