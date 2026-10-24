import { useId, type ChangeEvent, type FocusEvent, type InputHTMLAttributes, type ReactNode } from 'react';
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
  const generatedId = useId();
  const inputId = rest.id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className={['block', className ?? ''].join(' ')}>
      <span className="flex items-center justify-between text-xs font-medium text-text-muted mb-1">
        <label htmlFor={inputId}>{label}</label>
        {showError && (
          <span id={errorId} role="alert" className="flex items-center gap-1 text-[0.7rem] text-danger">
            <AlertCircle size={11} aria-hidden />
            {error}
          </span>
        )}
      </span>
      <input
        {...rest}
        id={inputId}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        disabled={disabled}
        autoComplete={rest.autoComplete ?? 'off'}
        aria-invalid={showError || undefined}
        aria-describedby={[showError && errorId, rest['aria-describedby']].filter(Boolean).join(' ') || undefined}
        className={[
          'w-full px-3 py-2 rounded-md text-sm text-text-primary bg-bg-elevated border transition-colors',
          'placeholder:text-text-muted',
          'focus:outline-none focus:ring-1 focus:border-accent focus:ring-accent',
          showError ? 'border-danger' : 'border-border-control hover:border-text-muted',
          disabled ? 'opacity-60 cursor-not-allowed' : '',
        ].join(' ')}
      />
    </div>
  );
};

export default InputField;
