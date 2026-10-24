import { useId, useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

import { IconButton } from '@app/components';
import { cx } from '@app/utils';

export interface LoginFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'onFocus'> {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  label: ReactNode;
  error?: string;
  touched?: boolean;
  revealable?: boolean;
  ref?: Ref<HTMLInputElement>;
}

const LoginField = ({ label, error, touched, revealable, type, className, ref, ...rest }: LoginFieldProps) => {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const showError = Boolean(touched && error);

  return (
    <div className={cx('flex min-w-0 flex-col gap-1', className)}>
      <span className="flex items-baseline justify-between gap-2 text-[12px] font-medium text-text-secondary">
        <label htmlFor={inputId}>{label}</label>
        {showError && (
          <span id={errorId} role="alert" className="flex items-center gap-1 text-[11px] text-danger">
            <AlertCircle size={11} aria-hidden />
            {error}
          </span>
        )}
      </span>
      <span
        className={cx(
          'flex h-10 items-center rounded-ui border bg-bg-sunken px-3',
          'focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25',
          showError ? 'border-danger' : 'border-border-control',
        )}
      >
        <input
          {...rest}
          ref={ref}
          id={inputId}
          type={revealable && revealed ? 'text' : type}
          autoComplete={rest.autoComplete ?? 'off'}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        {revealable && (
          <IconButton
            size="sm"
            className="-mr-1.5"
            label={revealed ? t('LoginForm.label.hidePassword') : t('LoginForm.label.showPassword')}
            onClick={() => setRevealed((r) => !r)}
          >
            {revealed ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
          </IconButton>
        )}
      </span>
    </div>
  );
};

export default LoginField;
