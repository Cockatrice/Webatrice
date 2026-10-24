import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Swords, UserRoundPlus, VolumeX } from 'lucide-react';

import { AuthGuard, Button, SeatDots, TextInput } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';
import { cx } from '@app/utils';

import JoinPrompts from './JoinPrompts';
import type { MyOpenGame } from './myOpenGame';
import { BuddyCard, CompactPerson, IgnoredRow, OtherOnlineActions, PersonMenuButton } from './PeopleRows';
import { CollapsibleSection, FacePile, PeopleGrid } from './PeopleSections';
import { usePeople, type InviteHint } from './usePeople';

const HINT_KEYS: Record<InviteHint, string> = {
  buddies: 'People.myGame.hintBuddies',
  others: 'People.myGame.hintOthers',
  noLink: 'People.myGame.hintNoLink',
};

function MyGameBanner({ game, hint }: { game: MyOpenGame; hint: string }) {
  const { t } = useTranslation();
  const description = game.description || t('People.myGame.untitled');
  return (
    <div role="status" className="flex items-center gap-3 rounded-ui-lg border border-accent/40 bg-accent-soft px-4 py-2.5">
      <Swords size={16} aria-hidden className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1 text-[13px] text-text-primary">
        <span className="font-semibold">
          {t(game.hosting ? 'People.myGame.hosting' : 'People.myGame.seated', { description })}
        </span>
        <span className="text-text-secondary"> · {t('People.myGame.seats', { seated: game.seated, max: game.max })} {hint}</span>
      </span>
      <SeatDots taken={game.seated} max={game.max} size={8} />
    </div>
  );
}

function IgnoreByName({ disabled, onIgnore }: { disabled: boolean; onIgnore: (name: string) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onIgnore(trimmed);
      setName('');
    }
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-2 px-2.5 pt-1" aria-label={t('People.add.ignoreLabel')}>
      <TextInput
        icon={null}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t('People.add.ignoreLabel')}
        aria-label={t('People.add.ignoreLabel')}
        disabled={disabled}
        wrapperClassName="flex-1"
      />
      <Button type="submit" size="sm" icon={<VolumeX size={14} />} disabled={disabled || !name.trim()}>
        {t('People.add.ignore')}
      </Button>
    </form>
  );
}

export default function People() {
  const { t } = useTranslation();
  const people = usePeople();
  const { totals, joinFlow, isOpen, toggle } = people;
  const ignoredId = useId();
  const busy = joinFlow.joinPending || joinFlow.waitingForRoom;
  const ignoredOpen = isOpen('ignored');
  const toggleIgnored = () => toggle('ignored');

  const addBuddy = (event: FormEvent) => {
    event.preventDefault();
    if (people.canAddQuery) {
      people.addBuddy(people.query.trim());
      people.setQuery('');
    }
  };

  return (
    <Layout>
      <AuthGuard />
      <div className="h-full min-h-0 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4 px-pad pb-10 pt-5">
          <header>
            <h1 className="font-display text-[22px] font-semibold text-text-primary">{t('People.title')}</h1>
            <p className="text-[12.5px] text-text-muted">
              {t('People.subtitle', { online: totals.online, buddies: totals.buddies, others: totals.others })}
            </p>
          </header>

          <form className="flex items-center gap-2" onSubmit={addBuddy} role="search">
            <TextInput
              type="search"
              value={people.query}
              onChange={(event) => people.setQuery(event.target.value)}
              placeholder={t('People.search.label')}
              aria-label={t('People.search.label')}
              wrapperClassName="flex-1"
            />
            <Button type="submit" icon={<UserRoundPlus size={14} />} disabled={!people.canAddQuery}>
              {t('People.add.buddy')}
            </Button>
          </form>

          {people.myGame && <MyGameBanner game={people.myGame} hint={t(HINT_KEYS[people.inviteHint])} />}

          {people.nothingMatches && (
            <p className="text-center text-[13px] text-text-muted">{t('People.search.noMatches', { query: people.query.trim() })}</p>
          )}

          {(!people.searching || people.onlineBuddies.length > 0) && (
            <section aria-labelledby="people-online">
              <h2
                id="people-online"
                className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted"
              >
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                {t('People.online.title')} · {people.onlineBuddies.length}
              </h2>
              {people.onlineBuddies.length === 0 ? (
                <p className="rounded-ui-lg border border-dashed border-border-strong px-pad py-6 text-center text-[13px] text-text-muted">
                  {totals.buddies === 0 ? t('People.online.noBuddies') : t('People.online.noneOnline')}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {people.onlineBuddies.map((buddy) => (
                    <BuddyCard
                      key={buddy.name}
                      buddy={buddy}
                      busy={busy}
                      onJoin={() => buddy.activity.kind === 'waiting' && joinFlow.join(buddy.activity.game)}
                      onWatch={() => buddy.activity.kind === 'playing' && joinFlow.watch(buddy.activity.game)}
                      onInvite={() => people.invite(buddy.name)}
                      onMessage={() => people.openChat(buddy.name)}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}

          {people.offlineBuddies.length > 0 && (
            <CollapsibleSection
              title={t('People.offline.title')}
              count={people.offlineBuddies.length}
              open={isOpen('offline')}
              onToggle={() => toggle('offline')}
              preview={<FacePile people={people.offlineBuddies} />}
            >
              <PeopleGrid
                people={people.offlineBuddies}
                label={t('People.offline.title')}
                renderPerson={(person) => (
                  <CompactPerson person={person}>
                    <PersonMenuButton person={person} />
                  </CompactPerson>
                )}
              />
            </CollapsibleSection>
          )}

          {people.othersOnline.length > 0 && (
            <CollapsibleSection
              title={t('People.others.title')}
              count={people.othersOnline.length}
              open={isOpen('others')}
              onToggle={() => toggle('others')}
              preview={<FacePile people={people.othersOnline} />}
            >
              <PeopleGrid
                people={people.othersOnline}
                label={t('People.others.title')}
                renderPerson={(person) => (
                  <CompactPerson person={person}>
                    <OtherOnlineActions
                      person={person}
                      canEdit={people.canEditLists}
                      onMessage={() => people.openChat(person.name)}
                      onAdd={() => people.addBuddy(person.name)}
                    />
                  </CompactPerson>
                )}
              />
            </CollapsibleSection>
          )}

          {(!people.searching || people.ignored.length > 0) && (
            <div className="self-start">
              <button
                type="button"
                aria-expanded={ignoredOpen}
                aria-controls={ignoredId}
                onClick={toggleIgnored}
                className={cx(
                  'rounded-ui px-2 py-1 text-[12px] text-text-muted hover:bg-bg-elevated',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                )}
              >
                <span className="flex items-center gap-1">
                  {ignoredOpen ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
                  {t('People.ignored.title')} · {totals.ignored}
                </span>
              </button>
              <div id={ignoredId} hidden={!ignoredOpen} className="w-[420px] max-w-full">
                {ignoredOpen && (
                  <>
                    {people.ignored.length === 0 ? (
                      <p className="px-2.5 py-1.5 text-[12.5px] text-text-muted">{t('People.ignored.empty')}</p>
                    ) : (
                      <ul aria-label={t('People.ignored.title')} className="max-h-[240px] overflow-y-auto">
                        {people.ignored.map((person) => (
                          <IgnoredRow
                            key={person.name}
                            person={person}
                            canEdit={people.canEditLists}
                            onRemove={() => people.removeIgnore(person.name)}
                          />
                        ))}
                      </ul>
                    )}
                    <IgnoreByName disabled={!people.canEditLists} onIgnore={people.addIgnore} />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <JoinPrompts flow={joinFlow} />
    </Layout>
  );
}
