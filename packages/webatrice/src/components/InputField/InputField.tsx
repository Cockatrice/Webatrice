import type { ChangeEvent, FocusEvent, InputHTMLAttributes, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

// Value/change/focus/blur are our own strict signatures; everything
// else (autoComplete, name, disabled, autoFocus, placeholder, min,
// max, step, pattern, etc.) is passthrough via InputHTMLAttributes,
// which matches the pre-Tailwind version's caller surface (that one
// extended MUI TextFieldProps for the same reason).
export interface InputFieldProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'onBlur' | 'onFocus'
  > {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  label: ReactNode;
  error?: string;
  touched?: boolean;
}

/**
 * Text input, Tailwind-only. Replaces the pre-redo MUI-TextField
 * wrapper. Same prop contract as before (value, onChange, label,
 * error, touched, name, autoComplete, etc.) so every caller across
 * the app keeps working without changes.
 */
const InputField = ({
  value,
  onChange,
  onBlur,
  onFocus,
  label,
  error,
  touched,
  className,
  disabled,
  ...rest
}: InputFieldProps) => {
  const showError = Boolean(touched && error);

  return (
    <label className={['block', className ?? ''].join(' ')}>
      <span className="flex items-center justify-between text-xs font-medium text-text-muted mb-1">
        <span>{label}</span>
        {showError && (
          <span className="flex items-center gap-1 text-[0.7rem] text-red-400">
            <AlertCircle size={11} />
            {error}
          </span>
        )}
      </span>
      <input
        {...rest}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        disabled={disabled}
        autoComplete={rest.autoComplete ?? 'off'}
        className={[
          'w-full px-3 py-2 rounded-md text-sm text-text-primary bg-bg-elevated border transition-colors',
          'placeholder:text-text-muted',
          'focus:outline-none focus:ring-1 focus:border-accent focus:ring-accent',
          showError ? 'border-red-400/60' : 'border-border-subtle hover:border-border-strong',
          disabled ? 'opacity-60 cursor-not-allowed' : '',
        ].join(' ')}
      />
    </label>
  );
};

export default InputField;
