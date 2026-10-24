import { type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, forwardRef, useState } from 'react';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Gavel, Search, Shield, ShieldCheck } from 'lucide-react';

import { useUserAvatar } from '../../hooks/useUserAvatar';
import { cx } from '../../utils/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

const buttonBase =
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
    'transition-colors focus-visible:outline focus-visible:outline-2',
    'focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed',
    'disabled:opacity-45 rounded-ui',
  ].join(' ');
const buttonVariant: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border border-border-strong text-text-primary hover:bg-bg-elevated hover:border-accent/60',
  ghost: 'text-accent hover:bg-accent/10',
  quiet: 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
  danger: 'border border-danger/50 text-danger hover:bg-danger/10',
};
const buttonSize: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[12px]',
  md: 'h-9 px-3.5 text-[13px]',
  lg: 'h-11 px-5 text-[14px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx(buttonBase, buttonVariant[variant], buttonSize[size], className)} {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  size?: ButtonSize;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, active, className, size = 'md', type = 'button', ...rest },
  ref,
) {
  const s = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cx(
        [
          'inline-flex shrink-0 items-center justify-center rounded-ui transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
          'disabled:cursor-not-allowed disabled:opacity-45',
        ].join(' '),
        active ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
        s,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

export type ChipTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export function Chip({
  children,
  tone = 'neutral',
  icon,
  className,
  outline,
  title,
}: {
  children: ReactNode;
  tone?: ChipTone;
  icon?: ReactNode;
  className?: string;
  outline?: boolean;
  title?: string;
}) {
  const tones: Record<ChipTone, string> = {
    neutral: outline ? 'border border-border-strong text-text-secondary' : 'bg-bg-elevated text-text-secondary',
    accent: outline ? 'border border-accent/60 text-accent' : 'bg-accent/15 text-accent',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/15 text-danger',
    info: 'bg-info/15 text-info',
  };
  return (
    <span
      title={title}
      className={cx(
        'inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11px] font-medium leading-none',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export type Availability = 'open' | 'password' | 'full' | 'started' | 'buddies';

const AVAILABILITY_TONE: Record<Availability, ChipTone> = {
  open: 'success',
  password: 'warning',
  full: 'neutral',
  started: 'info',
  buddies: 'accent',
};

const AVAILABILITY_LABEL: Record<Availability, (t: TFunction) => string> = {
  open: (t) => t('DesignSystem.availability.open'),
  password: (t) => t('DesignSystem.availability.password'),
  full: (t) => t('DesignSystem.availability.full'),
  started: (t) => t('DesignSystem.availability.started'),
  buddies: (t) => t('DesignSystem.availability.buddies'),
};

export function AvailabilityBadge({ state }: { state: Availability }) {
  const { t } = useTranslation();
  return (
    <Chip tone={AVAILABILITY_TONE[state]} icon={<span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}>
      {AVAILABILITY_LABEL[state](t)}
    </Chip>
  );
}

export function SeatDots({ taken, max, size = 10 }: { taken: number; max: number; size?: number }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={t('DesignSystem.seats', { taken, max })}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          style={{ width: size, height: size }}
          className={cx('rounded-full', i < taken ? 'bg-accent' : 'border-[1.5px] border-text-muted')}
        />
      ))}
    </span>
  );
}

export function Panel({
  title,
  count,
  actions,
  children,
  className,
  bodyClassName,
  flush,
  eyebrow,
  headingLevel = 2,
}: {
  title?: ReactNode;
  count?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
  eyebrow?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  return (
    <section
      className={cx('flex min-h-0 min-w-0 flex-col rounded-ui-lg border border-border-subtle bg-bg-surface shadow-panel', className)}
    >
      {title !== undefined && (
        <header className="flex min-h-[44px] items-center gap-3 border-b border-border-subtle px-pad py-2">
          <Heading
            className={cx(
              'min-w-0 truncate font-display text-text-primary',
              eyebrow ? 'text-[11px] font-semibold uppercase tracking-[0.08em]' : 'text-[15px] font-semibold',
            )}
          >
            {title}
          </Heading>
          {count !== undefined && <span className="text-[12px] text-text-muted">{count}</span>}
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={cx('min-h-0 flex-1', !flush && 'p-pad', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Divider({ vertical, className }: { vertical?: boolean; className?: string }) {
  return <span aria-hidden className={cx(vertical ? 'mx-1 h-5 w-px' : 'h-px w-full', 'shrink-0 bg-border-subtle', className)} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      className={cx(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-ui-sm border border-border-strong',
        'bg-bg-elevated px-1 font-mono text-[10px] text-text-secondary',
      )}
    >
      {children}
    </kbd>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode | null;
  label?: ReactNode;
  wrapperClassName?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { icon = <Search size={15} aria-hidden />, className, wrapperClassName, label, ...rest },
  ref,
) {
  return (
    <label className={cx('flex min-w-0 flex-col gap-1', wrapperClassName)}>
      {label && <span className="text-[12px] font-medium text-text-secondary">{label}</span>}
      <span
        className={cx(
          'flex h-9 min-w-0 items-center gap-2 rounded-ui border border-border-control bg-bg-sunken px-2.5 text-text-muted',
          'focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25',
        )}
      >
        {icon}
        <input
          ref={ref}
          className={cx(
            'h-full min-w-0 flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none',
            className,
          )}
          {...rest}
        />
      </span>
    </label>
  );
});

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        [
          'flex items-start gap-3 rounded-ui-sm text-left focus-visible:outline',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          'disabled:cursor-not-allowed disabled:opacity-45',
        ].join(' '),
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-bg-elevated ring-1 ring-inset ring-border-control',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-4 w-4 rounded-full shadow transition-all',
            checked ? 'left-[18px] bg-on-accent' : 'left-0.5 bg-text-muted',
          )}
        />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] text-text-primary">{label}</span>
        {hint && <span className="text-[12px] text-text-muted">{hint}</span>}
      </span>
    </button>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        [
          'flex items-center gap-2 rounded-ui-sm text-left text-[13px] text-text-primary',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45',
        ].join(' '),
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border',
          checked ? 'border-accent bg-accent text-on-accent' : 'border-border-control',
        )}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
            <path
              d="M2.5 6.2 5 8.5l4.5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}

export interface SegmentedItem<T extends string> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: SegmentedItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <span
      role="radiogroup"
      aria-label={label}
      className={cx('inline-flex rounded-ui border border-border-subtle bg-bg-sunken p-0.5', className)}
    >
      {items.map((it) => (
        <button
          type="button"
          role="radio"
          aria-checked={it.value === value}
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cx(
            [
              'rounded-[calc(var(--radius)-2px)] px-2.5 py-1 text-[12px] font-medium',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
            ].join(' '),
            it.value === value ? 'bg-bg-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary',
          )}
        >
          {it.label}
        </button>
      ))}
    </span>
  );
}

const AVATAR_HUES = [262, 200, 20, 150, 330, 45, 280, 180];

export function Avatar({ name, size = 28, ring, src }: { name: string; size?: number; ring?: boolean; src?: string }) {
  const userAvatar = useUserAvatar(src === undefined ? name : null);
  const [failed, setFailed] = useState<string | null>(null);
  const candidate = src ?? userAvatar.src ?? undefined;
  const image = candidate && candidate !== failed ? candidate : undefined;
  const h = AVATAR_HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_HUES.length];
  const style: CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.4),
    background: image ? undefined : `linear-gradient(135deg, hsl(${h} 55% 52%), hsl(${(h + 40) % 360} 60% 32%))`,
  };
  return (
    <span
      ref={userAvatar.ref}
      style={style}
      className={cx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-over-art-text',
        ring && 'ring-2 ring-accent ring-offset-2 ring-offset-bg-surface',
      )}
      aria-hidden
    >
      {image
        ? <img src={image} alt="" className="h-full w-full object-cover" onError={() => setFailed(image)} />
        : name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export type StaffRole = 'admin' | 'mod' | 'judge';

export function RoleBadge({ role, size = 13 }: { role: StaffRole; size?: number }) {
  const { t } = useTranslation();
  if (role === 'admin') {
    return <ShieldCheck size={size} className="text-danger" role="img" aria-label={t('DesignSystem.role.admin')} />;
  }
  if (role === 'mod') {
    return <Shield size={size} className="text-info" role="img" aria-label={t('DesignSystem.role.mod')} />;
  }
  return <Gavel size={size} className="text-warning" role="img" aria-label={t('DesignSystem.role.judge')} />;
}

const PIP: Record<string, string> = {
  W: 'bg-[#F8F2D2]',
  U: 'bg-[#A9D8F5]',
  B: 'bg-[#BEB6B2]',
  R: 'bg-[#F2A08A]',
  G: 'bg-[#9ED3AF]',
  C: 'bg-[#D4CFCB]',
};

export function ColorPips({ colors, size = 10, label }: { colors: string[]; size?: number; label?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-[3px]" role="img" aria-label={label ?? colors.join('')}>
      {colors.map((c) => (
        <span key={c} style={{ width: size, height: size }} className={cx('rounded-full ring-1 ring-black/20', PIP[c] ?? PIP.C)} />
      ))}
    </span>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted', className)}>{children}</span>;
}

export function PageTitle({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex min-h-[56px] shrink-0 items-center gap-3 px-pad py-2">
      <div className="min-w-0">
        <h1 className="truncate font-display text-[20px] font-semibold text-text-primary">{title}</h1>
        {subtitle && <p className="truncate text-[12px] text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
