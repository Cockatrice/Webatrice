import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff, KeyRound, RefreshCw, Search } from 'lucide-react';

import { Button, IconButton, TextInput } from '@app/components';
import { AlertDialog, ConfirmDialog } from '@app/dialogs';
import {
  sectionLabelClass,
  StaffConsole,
  StaffDrawer,
  StaffHeader,
  StaffTable,
  StaffToolGuard,
  UserSanctionButtons,
} from '@app/feature-wrappers/staff';

import BasicUserInfoPanel from './BasicUserInfoPanel';

import { useModerationColumns } from './moderationColumns';
import TemporaryPasswordDialog from './TemporaryPasswordDialog';
import UserInfoPanel from './UserInfoPanel';
import UserRecordButtons from './UserRecordButtons';
import { useModeration } from './useModeration';

function Section({ title, count, children, actions }: {
  title: string;
  count?: number;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex shrink-0 flex-col border-b border-border-subtle">
      <div className="flex h-10 items-center gap-2 px-5">
        <h2 className={sectionLabelClass}>{title}</h2>
        {count !== undefined && <span className="font-mono text-[11px] tabular-nums text-text-muted">{count}</span>}
        {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

const ModerationContent = () => {
  const { t } = useTranslation();
  const moderation = useModeration();
  const { currentUser, investigation, pending, parts } = moderation;
  const columns = useModerationColumns();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (currentUser) {
      setSearch(currentUser);
    }
  }, [currentUser]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    moderation.investigate(search);
  };

  const lookupStatus = (loading: boolean, rows: readonly unknown[] | undefined, emptyText: string) => {
    if (!parts.investigation) {
      return t('ModerationPage.needsServer');
    }
    if (!currentUser) {
      return t('ModerationPage.value.noUser');
    }
    if (loading) {
      return t('ModerationPage.value.loading');
    }
    return rows && rows.length > 0 ? undefined : emptyText;
  };

  const staffLoginsStatus = !parts.staffLogins
    ? t('ModerationPage.needsServer')
    : (moderation.staffLogins?.length ? undefined : t('ModerationPage.staff.empty'));

  const confirmText = moderation.confirm === 'resetPassword'
    ? { title: t('ModerationPage.confirm.resetTitle'), message: t('ModerationPage.confirm.reset', { userName: currentUser }) }
    : { title: t('ModerationPage.confirm.avatarTitle'), message: t('ModerationPage.confirm.avatar', { userName: currentUser }) };

  return (
    <>
      <StaffHeader
        title={t('ModerationPage.title')}
        subtitle={parts.investigation ? t('ModerationPage.subtitle') : t('ModerationPage.subtitleBasic')}
        actions={(
          <form role="search" className="flex items-center gap-2" onSubmit={submit}>
            <TextInput
              type="search"
              aria-label={t('ModerationPage.search.placeholder')}
              placeholder={t('ModerationPage.search.placeholder')}
              icon={<Search size={14} aria-hidden />}
              wrapperClassName="w-[220px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit" variant="primary">{t('ModerationPage.search.investigate')}</Button>
          </form>
        )}
      />
      <div className="flex min-h-0 flex-1 border-t border-border-subtle">
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <Section
            title={t('ModerationPage.alts.title')}
            count={currentUser && parts.investigation ? investigation.alts?.length : undefined}
          >
            <StaffTable
              label={t('ModerationPage.alts.title')}
              columns={columns.alts}
              tableClassName="min-w-[760px]"
              rows={investigation.alts ?? []}
              rowKey={(a) => a.userName}
              status={lookupStatus(pending.alts, investigation.alts, t('ModerationPage.alts.empty'))}
            />
          </Section>
          <Section
            title={t('ModerationPage.sessions.title')}
            count={currentUser && parts.investigation ? investigation.sessions?.length : undefined}
          >
            <StaffTable
              label={t('ModerationPage.sessions.title')}
              columns={columns.sessions}
              rows={investigation.sessions ?? []}
              rowKey={(s) => `${s.startTime}-${s.ipAddress}-${s.clientid}`}
              status={lookupStatus(pending.sessions, investigation.sessions, t('ModerationPage.sessions.empty'))}
            />
          </Section>
          <Section
            title={t('ModerationPage.staff.title')}
            count={parts.staffLogins ? moderation.staffLogins?.length : undefined}
            actions={parts.staffLogins && (
              <IconButton size="sm" label={t('ModerationPage.staff.refresh')} onClick={moderation.refreshStaffLogins}>
                <RefreshCw size={13} aria-hidden />
              </IconButton>
            )}
          >
            <StaffTable
              label={t('ModerationPage.staff.title')}
              columns={columns.staff}
              rows={moderation.staffLogins ?? []}
              rowKey={(l) => l.userName}
              status={staffLoginsStatus}
            />
          </Section>
        </div>
        <StaffDrawer
          label={t('ModerationPage.info.drawer')}
          title={(
            <span className="font-display text-[17px] font-semibold text-text-primary">
              {currentUser || t('ModerationPage.info.noUser')}
            </span>
          )}
          subtitle={t('ModerationPage.info.title')}
          actions={(
            <>
              {moderation.canResetPassword && (
                <Button
                  size="sm"
                  icon={<KeyRound size={13} aria-hidden />}
                  disabled={!currentUser}
                  onClick={() => moderation.requestConfirm('resetPassword')}
                >
                  {t('ModerationPage.action.resetPassword')}
                </Button>
              )}
              {moderation.canRemoveAvatar && (
                <Button
                  size="sm"
                  icon={<ImageOff size={13} aria-hidden />}
                  disabled={!currentUser}
                  onClick={() => moderation.requestConfirm('removeAvatar')}
                >
                  {t('ModerationPage.action.removeAvatar')}
                </Button>
              )}
            </>
          )}
        >
          {parts.investigation ? (
            <UserInfoPanel
              userName={currentUser}
              info={investigation.info}
              loading={pending.info}
              error={moderation.infoError}
            />
          ) : (
            <BasicUserInfoPanel
              userName={currentUser}
              info={moderation.userInfo}
              loading={pending.info}
              error={moderation.infoError}
            />
          )}
          {currentUser && <UserSanctionButtons userName={currentUser} />}
          {currentUser && <UserRecordButtons userName={currentUser} />}
        </StaffDrawer>
      </div>

      <ConfirmDialog
        isOpen={moderation.confirm !== null}
        title={confirmText.title}
        message={confirmText.message}
        confirmLabel={t('ModerationPage.button.ok')}
        cancelLabel={t('ModerationPage.button.cancel')}
        destructive
        cancelDefault
        onConfirm={moderation.confirmAction}
        onCancel={moderation.cancelConfirm}
      />
      <TemporaryPasswordDialog result={moderation.temporaryPassword} onDismiss={moderation.dismissTemporaryPassword} />
      <AlertDialog
        isOpen={moderation.notice !== null}
        title={moderation.notice?.title ?? ''}
        message={moderation.notice?.message ?? ''}
        severity={moderation.notice?.severity ?? 'info'}
        buttonLabel={t('ModerationPage.button.ok')}
        onDismiss={moderation.dismissNotice}
      />
    </>
  );
};

const Moderation = () => (
  <StaffConsole>
    <StaffToolGuard tool="moderation">
      <ModerationContent />
    </StaffToolGuard>
  </StaffConsole>
);

export default Moderation;
