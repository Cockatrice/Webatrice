import type { ChangeEvent, FocusEvent } from 'react';
import { Check } from 'lucide-react';

export interface CheckboxFieldProps {
  value: boolean | undefined;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  name?: string;
  label?: string;
  disabled?: boolean;
}

/**
 * Tailwind checkbox with visible checked/unchecked states. Native
 * `<input type=checkbox>` is visually-hidden (peer) so keyboard focus,
 * screen readers, and form libraries all still work; the box painted
 * on top uses our accent when checked. Same prop contract as the
 * pre-redo MUI-wrapping version so callers don't need to change.
 */
const CheckboxField = ({
  value,
  onChange,
  onBlur,
  onFocus,
  name,
  label,
  disabled,
}: CheckboxFieldProps) => {
  const checked = Boolean(value);
  return (
    <label
      className={[
        'inline-flex items-center gap-2 select-none',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      ].join(' ')}
    >
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          className={[
            'h-4 w-4 rounded border flex items-center justify-center transition-colors',
            checked ? 'bg-accent border-accent' : 'bg-bg-elevated border-border-strong',
            !disabled && !checked ? 'peer-hover:border-accent' : '',
            !disabled
              ? 'peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-surface'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {checked && <Check size={11} strokeWidth={3} className="text-white" />}
        </span>
      </span>
      {label != null && <span className="text-sm text-text-secondary">{label}</span>}
    </label>
  );
};

export default CheckboxField;
