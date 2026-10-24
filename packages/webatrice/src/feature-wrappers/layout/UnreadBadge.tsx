import { useTranslation } from 'react-i18next';

export default function UnreadBadge({ count, className = '' }: { count: number; className?: string }) {
  const { t } = useTranslation();
  if (count <= 0) {
    return null;
  }
  return (
    <>
      <span
        aria-hidden
        className={[
          'inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-accent px-1',
          'text-[10px] font-bold tabular-nums text-on-accent',
          className,
        ].join(' ')}
      >
        {count > 99 ? '99+' : count}
      </span>
      {' '}
      <span className="sr-only">{t('UnreadBadge.label', { count })}</span>
    </>
  );
}
