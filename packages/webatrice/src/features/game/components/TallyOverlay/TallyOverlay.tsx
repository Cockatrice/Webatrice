import { useTranslation } from 'react-i18next';
import { usePreference } from '@app/hooks';

import { useSelectionTally } from '../../hooks/useSelectionTally';

const PANEL_CLASS = [
  'pointer-events-none select-none rounded-md',
  'bg-bg-surface/85 border border-border-subtle px-2 py-1 text-xs text-text-primary shadow-glow',
].join(' ');

export default function TallyOverlay() {
  const { t } = useTranslation();
  const { rows, count: selected } = useSelectionTally();
  const showCount = usePreference('showTotalSelectionCount');
  const count = showCount ? selected : 0;
  return (
    <>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {t('TallyOverlay.selectedCount', { count: selected })}
      </span>
      {(rows.length > 0 || count > 1) && (
        <div className="absolute bottom-2.5 right-2.5 z-10 flex flex-col items-end gap-1 pointer-events-none">
          {rows.length > 0 && (
            <div role="status" aria-label={t('TallyOverlay.tally')} className={PANEL_CLASS}>
              <table>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name}>
                      <td className="pr-3">{row.name}</td>
                      <td className="text-right tabular-nums">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {count > 1 && (
            <div aria-hidden="true" className={`${PANEL_CLASS} tabular-nums`}>
              {count}
            </div>
          )}
        </div>
      )}
    </>
  );
}
