import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@app/components';
import { readLoadTimings } from '../../utils/loadTimings';

export default function LoadTimings() {
  const { t } = useTranslation();
  const [rows, setRows] = useState(readLoadTimings);
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null);
  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined') {
      return;
    }
    const observer = new PerformanceObserver(() => setRows(readLoadTimings()));
    observer.observe({ entryTypes: ['measure'] });
    setRows(readLoadTimings());
    return () => observer.disconnect();
  }, []);
  const text = rows.map(({ name, milliseconds, detail }) =>
    `${name}: ${milliseconds === undefined ? 'pending' : `${milliseconds.toFixed(1)} ms`}${detail ? ` (${detail})` : ''}`,
  ).join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  };
  return (
    <section className="border-t border-border-subtle px-5 py-3" aria-label={t('Developer.timings.title')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-text-primary">{t('Developer.timings.title')}</h2>
        <Button onClick={copy}>{t('DebugLogDialog.copy')}</Button>
      </div>
      <p className="text-xs text-text-muted">{t('Developer.timings.description')}</p>
      <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-text-secondary">{text}</pre>
      {copied && <p role="status">{t(copied === 'done' ? 'DebugLogDialog.copied' : 'DebugLogDialog.copyFailed')}</p>}
    </section>
  );
}
