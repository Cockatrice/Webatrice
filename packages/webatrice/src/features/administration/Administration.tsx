import { useMemo, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Lock, LockOpen, MessageSquareText, Power, RefreshCw, ShieldCheck, Film } from 'lucide-react';

import { Button, TextInput } from '@app/components';
import { AlertDialog } from '@app/dialogs';
import { sectionLabelClass, StaffConsole, StaffHeader, StaffToolGuard } from '@app/feature-wrappers/staff';
import { cx } from '@app/utils';

import {
  buildActivateUserSchema,
  buildGrantReplaySchema,
  type ActivateUserFormValues,
  type GrantReplayFormValues,
} from './administrationSchemas';
import ShutdownDialog from './ShutdownDialog';
import { useAdministration } from './useAdministration';

const rowClass = 'flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle px-5 py-3 last:border-b-0';

interface FunctionRowProps {
  icon: ReactNode;
  title: string;
  description: string;
  disabled: boolean;
  children: ReactNode;
}

const FunctionRow = ({ icon, title, description, disabled, children }: FunctionRowProps) => (
  <li className={cx(rowClass, disabled && 'opacity-60')}>
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ui bg-bg-elevated text-text-secondary" aria-hidden>
      {icon}
    </span>
    <div className="flex min-w-[220px] flex-1 flex-col">
      <span className="text-[13px] font-semibold text-text-primary">{title}</span>
      <span className="text-[12px] text-text-muted">{description}</span>
    </div>
    <div className="flex items-start gap-2">{children}</div>
  </li>
);

interface SingleFieldFormProps {
  disabled: boolean;
  onSubmit: (value: string) => void;
}

const GrantReplayForm = ({ disabled, onSubmit }: SingleFieldFormProps) => {
  const { t } = useTranslation();
  const resolver = useMemo(() => zodResolver(buildGrantReplaySchema(t)), [t]);
  const { control, handleSubmit, watch } = useForm<GrantReplayFormValues>({ defaultValues: { replayId: '' }, resolver });
  const empty = watch('replayId').trim() === '';

  return (
    <form className="flex items-start gap-2" onSubmit={handleSubmit(({ replayId }) => onSubmit(replayId))} noValidate>
      <Controller
        name="replayId"
        control={control}
        render={({ field, fieldState }) => (
          <span className="flex flex-col gap-1">
            <TextInput
              {...field}
              icon={null}
              wrapperClassName="w-[150px]"
              onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
              disabled={disabled}
              inputMode="numeric"
              placeholder={t('Administration.moderator.replayId')}
              aria-label={t('Administration.moderator.replayId')}
              aria-invalid={Boolean(fieldState.error)}
            />
            {fieldState.error && <span role="alert" className="text-[12px] text-danger">{fieldState.error.message}</span>}
          </span>
        )}
      />
      <Button type="submit" disabled={disabled || empty}>{t('Administration.moderator.grantReplayAccess')}</Button>
    </form>
  );
};

const ActivateUserForm = ({ disabled, onSubmit }: SingleFieldFormProps) => {
  const { t } = useTranslation();
  const resolver = useMemo(() => zodResolver(buildActivateUserSchema(t)), [t]);
  const { control, handleSubmit, watch } = useForm<ActivateUserFormValues>({ defaultValues: { userName: '' }, resolver });
  const empty = watch('userName') === '';

  return (
    <form className="flex items-start gap-2" onSubmit={handleSubmit(({ userName }) => onSubmit(userName))} noValidate>
      <Controller
        name="userName"
        control={control}
        render={({ field, fieldState }) => (
          <span className="flex flex-col gap-1">
            <TextInput
              {...field}
              icon={null}
              wrapperClassName="w-[150px]"
              disabled={disabled}
              placeholder={t('Administration.moderator.userToActivate')}
              aria-label={t('Administration.moderator.userToActivate')}
              aria-invalid={Boolean(fieldState.error)}
            />
            {fieldState.error && <span role="alert" className="text-[12px] text-danger">{fieldState.error.message}</span>}
          </span>
        )}
      />
      <Button type="submit" disabled={disabled || empty}>{t('Administration.moderator.forceActivateUser')}</Button>
    </form>
  );
};

const AdministrationContent = () => {
  const { t } = useTranslation();
  const admin = useAdministration();
  const serverDisabled = !admin.adminFunctionsEnabled;
  const moderatorDisabled = !admin.moderatorFunctionsEnabled;

  return (
    <>
      <StaffHeader title={t('Administration.title')} subtitle={t('Administration.subtitle')} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border-t border-border-subtle px-5 py-4">
        {admin.locked && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-3 rounded-ui-lg border border-border-subtle bg-bg-surface px-4 py-3 text-[13px]"
          >
            <Lock size={16} className="text-text-muted" aria-hidden />
            <span className="flex-1 text-text-secondary">{t('Administration.lockedNotice')}</span>
            <Button size="sm" icon={<LockOpen size={13} aria-hidden />} onClick={admin.unlock}>{t('Administration.button.unlock')}</Button>
          </div>
        )}

        <section aria-labelledby="administration-admin-title" className="rounded-ui-lg border border-border-subtle bg-bg-surface">
          <h2 id="administration-admin-title" className={cx(sectionLabelClass, 'block border-b border-border-subtle px-5 py-2.5')}>
            {t('Administration.admin.title')}
          </h2>
          <ul>
            <FunctionRow
              icon={<MessageSquareText size={15} />}
              title={t('Administration.admin.updateServerMessage')}
              description={t('Administration.admin.updateServerMessageHint')}
              disabled={serverDisabled}
            >
              <Button disabled={serverDisabled} onClick={admin.updateServerMessage}>{t('Administration.admin.updateServerMessage')}</Button>
            </FunctionRow>
            <FunctionRow
              icon={<RefreshCw size={15} />}
              title={t('Administration.admin.reloadConfig')}
              description={t('Administration.admin.reloadConfigHint')}
              disabled={serverDisabled}
            >
              <Button disabled={serverDisabled} onClick={admin.reloadConfig}>{t('Administration.admin.reloadConfig')}</Button>
            </FunctionRow>
            <FunctionRow
              icon={<Power size={15} />}
              title={t('Administration.admin.shutdownServer')}
              description={t('Administration.admin.shutdownServerHint')}
              disabled={serverDisabled}
            >
              <Button variant="danger" disabled={serverDisabled} onClick={admin.openShutdownDialog}>
                {t('Administration.admin.shutdownServer')}
              </Button>
            </FunctionRow>
          </ul>
          {!admin.isAdmin && (
            <p className="border-t border-border-subtle px-5 py-2.5 text-[12px] text-text-muted">{t('Administration.admin.adminOnly')}</p>
          )}
        </section>

        <section aria-labelledby="administration-moderator-title" className="rounded-ui-lg border border-border-subtle bg-bg-surface">
          <h2 id="administration-moderator-title" className={cx(sectionLabelClass, 'block border-b border-border-subtle px-5 py-2.5')}>
            {t('Administration.moderator.title')}
          </h2>
          <ul>
            <FunctionRow
              icon={<Film size={15} />}
              title={t('Administration.moderator.grantReplayAccess')}
              description={t('Administration.moderator.grantReplayAccessHint')}
              disabled={moderatorDisabled}
            >
              <GrantReplayForm
                disabled={moderatorDisabled}
                onSubmit={(replayId) => admin.grantReplayAccess(Number(replayId))}
              />
            </FunctionRow>
            <FunctionRow
              icon={<ShieldCheck size={15} />}
              title={t('Administration.moderator.forceActivateUser')}
              description={t('Administration.moderator.forceActivateUserHint')}
              disabled={moderatorDisabled}
            >
              <ActivateUserForm disabled={moderatorDisabled} onSubmit={admin.forceActivateUser} />
            </FunctionRow>
          </ul>
        </section>
      </div>

      <ShutdownDialog
        isOpen={admin.shutdownDialogOpen}
        onSubmit={admin.shutdownServer}
        onCancel={admin.closeShutdownDialog}
      />
      <AlertDialog
        isOpen={admin.notice !== null}
        title={admin.notice?.title ?? ''}
        message={admin.notice?.message ?? ''}
        severity={admin.notice?.severity ?? 'info'}
        buttonLabel={t('Administration.button.ok')}
        onDismiss={admin.dismissNotice}
      />
    </>
  );
};

const Administration = () => (
  <StaffConsole>
    <StaffToolGuard tool="administration">
      <AdministrationContent />
    </StaffToolGuard>
  </StaffConsole>
);

export default Administration;
