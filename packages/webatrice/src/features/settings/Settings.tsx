import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';

import { AuthGuard, Kbd } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';
import { cx } from '@app/utils';

import { focusRing } from './controls/fields';
import Highlight from './Highlight';
import { SettingsSectionId, type SettingsSection } from './registry';
import RestoreDefaultsButton from './RestoreDefaultsButton';
import { groupDomId, sectionDomId } from './scrollSpy';
import { shortcutCount, type FilteredSection } from './searchSettings';
import { settingsSections } from './sections';
import SettingRow from './SettingRow';
import ShortcutMatches from './ShortcutMatches';
import { useSettingsPage } from './useSettingsPage';

const SECTION_BLURB_KEYS: Record<SettingsSectionId, string> = {
  [SettingsSectionId.General]: 'Settings.blurb.general',
  [SettingsSectionId.Appearance]: 'Settings.blurb.appearance',
  [SettingsSectionId.UserInterface]: 'Settings.blurb.userInterface',
  [SettingsSectionId.CardSources]: 'Settings.blurb.cardSources',
  [SettingsSectionId.Storage]: 'Settings.blurb.storage',
  [SettingsSectionId.Chat]: 'Settings.blurb.chat',
  [SettingsSectionId.Sound]: 'Settings.blurb.sound',
  [SettingsSectionId.Shortcuts]: 'Settings.blurb.shortcuts',
};

interface SettingsProps {
  sections?: readonly SettingsSection[];
}

const totalEntries = (sections: readonly SettingsSection[]) =>
  sections.reduce((sum, s) => sum + (s.groups ?? []).reduce((n, g) => n + g.entries.length, 0), 0);

const Settings = ({ sections = settingsSections }: SettingsProps) => {
  const { t } = useTranslation();
  const page = useSettingsPage(sections);
  const { query, searching, result, active, flash, jump } = page;
  const shownCount = (entry: FilteredSection) => {
    if (!entry.section.page) {
      return entry.count;
    }
    return !searching || (entry.titleMatch && result.shortcuts.length === 0) ? shortcutCount : result.shortcuts.length;
  };
  const visible = result.sections.filter((entry) => !searching || entry.titleMatch || shownCount(entry) > 0);
  const nothing = searching && visible.length === 0;

  return (
    <Layout>
      <AuthGuard />
      <div className="flex h-full min-h-0 flex-col bg-bg-base">
        <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle px-6 py-3.5">
          <div className="flex w-[212px] shrink-0 flex-col">
            <h1 className="font-display text-[22px] font-semibold leading-tight text-text-primary">{t('Settings.title')}</h1>
            <span className="text-[12px] text-text-muted">{t('Settings.subtitle')}</span>
          </div>
          <label
            className={cx(
              'flex h-10 w-[460px] min-w-0 max-w-full items-center gap-2 rounded-ui border border-border-control bg-bg-sunken px-3',
              'text-text-muted focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25',
            )}
          >
            <Search size={16} aria-hidden />
            <input
              ref={page.searchRef}
              type="search"
              value={query}
              onChange={(e) => page.setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && query) {
                  e.preventDefault();
                  page.setQuery('');
                }
              }}
              placeholder={t('Settings.searchPlaceholder', { settings: totalEntries(sections), shortcuts: shortcutCount })}
              aria-label={t('Settings.searchLabel')}
              aria-keyshortcuts="/"
              className={cx(
                'min-w-0 flex-1 bg-transparent text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none',
                '[&::-webkit-search-cancel-button]:hidden',
              )}
            />
            {searching ? (
              <button
                type="button"
                aria-label={t('Settings.clearSearch')}
                onClick={() => {
                  page.setQuery('');
                  page.searchRef.current?.focus();
                }}
                className={cx('rounded-ui-sm p-1 hover:text-text-primary', focusRing)}
              >
                <X size={14} aria-hidden />
              </button>
            ) : (
              <Kbd>/</Kbd>
            )}
          </label>
          {searching && (
            <span role="status" className="text-[13px] tabular-nums text-text-secondary">
              {t('Settings.matchCount', { count: result.settingCount, shortcuts: result.shortcuts.length })}
            </span>
          )}
          <span className="ml-auto">
            <RestoreDefaultsButton
              sections={sections}
              label={t('Settings.restoreAll')}
              title={t('Settings.restoreDefaultsConfirm.allTitle')}
              message={t('Settings.restoreDefaultsConfirm.allMessage')}
            />
          </span>
        </header>
        <div className="flex min-h-0 flex-1">
          <nav
            aria-label={t('Settings.jumpTo')}
            className="flex w-[260px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border-subtle px-3 py-4 max-md:hidden"
          >
            {result.sections.map((entry) => {
              const { section, groups } = entry;
              const Icon = section.icon;
              const on = !searching && section.id === active;
              const count = shownCount(entry);
              const empty = searching && count === 0 && !entry.titleMatch;
              return (
                <div key={section.id} className="flex flex-col">
                  <button
                    type="button"
                    disabled={empty}
                    aria-current={on ? 'location' : undefined}
                    onClick={() => jump(section.id)}
                    className={cx(
                      'flex h-9 items-center gap-3 rounded-ui px-3 text-left text-[13px] font-medium',
                      on ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
                      empty && 'cursor-not-allowed opacity-40',
                      focusRing,
                    )}
                  >
                    <Icon size={15} aria-hidden />
                    <span className="flex-1">{t(section.titleKey)}</span>
                    <span
                      className={cx(
                        'font-mono text-[11px] tabular-nums',
                        on ? 'text-accent' : 'text-text-muted',
                        searching && count > 0 && 'rounded-full bg-warning/20 px-1.5 text-text-primary',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                  {on && groups.length > 1 && (
                    <div className="mb-1 ml-[22px] flex flex-col border-l border-border-subtle py-0.5 pl-3">
                      {groups.map(({ group }) => (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => jump(section.id, group.id)}
                          className={cx(
                            'h-7 truncate rounded-ui-sm px-2 text-left text-[12px] text-text-muted',
                            'hover:bg-bg-elevated hover:text-text-primary',
                            focusRing,
                          )}
                        >
                          {t(group.titleKey)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div ref={page.scrollerRef} onScroll={page.onScroll} className="relative min-h-0 flex-1 overflow-y-auto">
            <div className="flex max-w-[920px] flex-col px-8 pb-24">
              {visible.map((entry) => (
                <SectionBlock key={entry.section.id} entry={entry} query={query}>
                  {entry.section.page ? (
                    <GroupCard id={`${entry.section.id}.page`} title={t('Settings.shortcuts.title')} query={query} flash={false}>
                      <ShortcutMatches page={entry.section.page} query={query} hits={result.shortcuts} searching={searching} />
                    </GroupCard>
                  ) : (
                    entry.groups.map(({ group, entries }, index) => (
                      <GroupCard
                        key={group.id}
                        id={group.id}
                        title={t(group.titleKey)}
                        query={query}
                        flash={flash === group.id || (index === 0 && flash === entry.section.id)}
                      >
                        {entries.map((setting) => <SettingRow key={setting.id} entry={setting} query={query} />)}
                      </GroupCard>
                    ))
                  )}
                </SectionBlock>
              ))}
              {nothing && (
                <div className="flex flex-col items-center gap-2 py-24 text-center">
                  <span className="text-[15px] font-medium text-text-primary">{t('Settings.noResults', { query: query.trim() })}</span>
                  <span className="text-[13px] text-text-muted">{t('Settings.noResultsHint')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

interface SectionBlockProps {
  entry: FilteredSection;
  query: string;
  children: React.ReactNode;
}

function SectionBlock({ entry, query, children }: SectionBlockProps) {
  const { t } = useTranslation();
  const { section } = entry;
  const title = t(section.titleKey);
  const headingId = `${sectionDomId(section.id)}-heading`;
  return (
    <section id={sectionDomId(section.id)} aria-labelledby={headingId} className="flex flex-col gap-3 pb-8">
      <div
        data-section-header
        className="sticky top-0 z-10 -mx-8 flex flex-wrap items-end gap-3 bg-bg-base/95 px-8 pb-2 pt-5 backdrop-blur"
      >
        <div className="flex flex-col">
          <h2 id={headingId} tabIndex={-1} className="font-display text-[18px] font-semibold text-text-primary outline-none">
            <Highlight text={title} query={query} />
          </h2>
          <span className="text-[12px] text-text-muted">{t(SECTION_BLURB_KEYS[section.id])}</span>
        </div>
        <span className="ml-auto">
          <RestoreDefaultsButton
            sections={[section]}
            size="sm"
            label={t('Settings.restoreSection', { section: title })}
            title={t('Settings.restoreDefaultsConfirm.title', { section: title })}
            message={t('Settings.restoreDefaultsConfirm.message', { section: title })}
          />
        </span>
      </div>
      {children}
    </section>
  );
}

interface GroupCardProps {
  id: string;
  title: string;
  query: string;
  flash: boolean;
  children: React.ReactNode;
}

function GroupCard({ id, title, query, flash, children }: GroupCardProps) {
  const headingId = `${groupDomId(id)}-heading`;
  return (
    <section
      id={groupDomId(id)}
      aria-labelledby={headingId}
      className={cx(
        'overflow-hidden rounded-ui-lg border bg-bg-surface transition-[box-shadow,border-color] duration-700',
        flash ? 'border-accent shadow-[inset_3px_0_0_rgb(var(--accent-primary))] ring-2 ring-accent/30' : 'border-border-subtle',
      )}
    >
      <h3
        id={headingId}
        tabIndex={-1}
        className={cx(
          'border-b border-border-subtle px-pad py-2.5 outline-none',
          'text-[12px] font-semibold uppercase tracking-[0.07em] text-text-muted',
        )}
      >
        <Highlight text={title} query={query} />
      </h3>
      <div className="divide-y divide-border-subtle">{children}</div>
    </section>
  );
}

export default Settings;
