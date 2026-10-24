import { useTranslation } from 'react-i18next';

const SOURCES = ['moxfield', 'archidekt', 'arena', 'mtgo', 'cockatrice'] as const;

const SOURCE_NAME_KEYS = {
  moxfield: 'ExportHelp.source.moxfield.name',
  archidekt: 'ExportHelp.source.archidekt.name',
  arena: 'ExportHelp.source.arena.name',
  mtgo: 'ExportHelp.source.mtgo.name',
  cockatrice: 'ExportHelp.source.cockatrice.name',
} as const;

const SOURCE_STEP_KEYS = {
  moxfield: 'ExportHelp.source.moxfield.steps',
  archidekt: 'ExportHelp.source.archidekt.steps',
  arena: 'ExportHelp.source.arena.steps',
  mtgo: 'ExportHelp.source.mtgo.steps',
  cockatrice: 'ExportHelp.source.cockatrice.steps',
} as const;

export function ExportHelp() {
  const { t } = useTranslation();
  return (
    <details className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-secondary">
      <summary
        className="cursor-pointer font-medium text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {t('ExportHelp.title')}
      </summary>
      <dl className="mt-2 grid gap-x-3 gap-y-1.5" style={{ gridTemplateColumns: 'max-content 1fr' }}>
        {SOURCES.map((source) => (
          <div key={source} className="contents">
            <dt className="font-semibold text-text-primary">{t(SOURCE_NAME_KEYS[source])}</dt>
            <dd>{t(SOURCE_STEP_KEYS[source])}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
