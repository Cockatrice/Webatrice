import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { useWebClient } from '@cockatrice/datatrice/react';
import { Response_ResponseCode } from '@cockatrice/sockatrice/generated';

import AlertDialog from '../AlertDialog/AlertDialog';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import DialogShell from '../DialogShell/DialogShell';
import { REPORT_CATEGORIES } from './reportCategories';
import { buildReportUserFormSchema, type ReportUserFormValues } from './reportUserFormSchema';

export interface OpenReportUserParams {
  userName: string;
  gameId?: number;
  chatContext?: string;
}

interface ReportUserDialogProps {
  request: OpenReportUserParams;
  onClose: () => void;
}

type SubmitState = 'editing' | 'confirming' | 'submitting' | 'submitted';

const INPUT_CLASS =
  'w-full bg-bg-base border border-border-control rounded-md px-3 py-2 text-sm '
  + 'text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';

const GROUP_CLASS = 'flex flex-col gap-2 rounded-md border border-border-subtle p-3';

const GROUP_TITLE_CLASS = 'text-xs font-semibold uppercase tracking-wide text-text-muted';

function failureKey(responseCode: number): string {
  if (responseCode === Response_ResponseCode.RespTooManyRequests) {
    return 'ReportUserDialog.error.tooManyRequests';
  }
  if (responseCode === Response_ResponseCode.RespNameNotFound) {
    return 'ReportUserDialog.error.nameNotFound';
  }
  return 'ReportUserDialog.error.generic';
}

export default function ReportUserDialog({ request, onClose }: ReportUserDialogProps) {
  const { t } = useTranslation();
  const gameIdErrorId = useId();
  const descriptionErrorId = useId();
  const webClient = useWebClient();
  const { userName, gameId, chatContext } = request;
  const hasFixedGame = gameId !== undefined && gameId > 0;
  const chatLog = chatContext?.trim() ?? '';

  const [submitState, setSubmitState] = useState<SubmitState>('editing');
  const [failure, setFailure] = useState<string | null>(null);
  const pendingValues = useRef<ReportUserFormValues | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const schema = useMemo(() => buildReportUserFormSchema(t), [t]);
  const { control, handleSubmit, watch } = useForm<ReportUserFormValues>({
    defaultValues: { category: REPORT_CATEGORIES[0], gameId: '', description: '' },
    resolver: zodResolver(schema),
  });
  const category = watch('category');

  const onValid = handleSubmit((values) => {
    pendingValues.current = values;
    setFailure(null);
    setSubmitState('confirming');
  });

  const send = () => {
    const values = pendingValues.current;
    if (!values) {
      return;
    }
    const typedGameId = values.gameId === '' ? undefined : Number(values.gameId);
    setSubmitState('submitting');
    webClient.request.session.report(
      {
        reportedUser: userName,
        category: values.category,
        description: values.description,
        gameId: hasFixedGame ? gameId : typedGameId,
        chatLog: chatLog || undefined,
      },
      () => {
        if (mounted.current) {
          setSubmitState('submitted');
        }
      },
      (responseCode) => {
        if (mounted.current) {
          setFailure(t(failureKey(responseCode)));
          setSubmitState('editing');
        }
      },
    );
  };

  const busy = submitState === 'submitting';

  return (
    <>
      <DialogShell
        isOpen
        title={t('ReportUserDialog.title')}
        handleClose={busy ? undefined : onClose}
        maxWidth="max-w-xl"
      >
        <form className="flex flex-col gap-3" onSubmit={onValid} noValidate>
          <p className="text-xs text-text-muted">{t('ReportUserDialog.info')}</p>

          <section className={GROUP_CLASS} aria-label={t('ReportUserDialog.detailsGroup')}>
            <h3 className={GROUP_TITLE_CLASS}>{t('ReportUserDialog.detailsGroup')}</h3>
            <div className="grid grid-cols-[max-content_1fr] items-center gap-x-3 gap-y-2">
              <span>{t('ReportUserDialog.reportedUser')}</span>
              <span className="font-semibold text-text-primary" data-testid="report-reported-user">{userName}</span>
              {hasFixedGame ? (
                <span id="report-user-game-id-label">{t('ReportUserDialog.gameId')}</span>
              ) : (
                <label htmlFor="report-user-game-id">{t('ReportUserDialog.gameId')}</label>
              )}
              {hasFixedGame ? (
                <span
                  id="report-user-game-id"
                  aria-labelledby="report-user-game-id-label"
                  className="font-semibold text-text-primary"
                >
                  {gameId}
                </span>
              ) : (
                <Controller
                  name="gameId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <div className="flex flex-col gap-1">
                      <input
                        {...field}
                        id="report-user-game-id"
                        inputMode="numeric"
                        className={INPUT_CLASS}
                        placeholder={t('ReportUserDialog.gameIdPlaceholder')}
                        title={t('ReportUserDialog.gameIdTooltip')}
                        disabled={busy}
                        aria-invalid={fieldState.error ? true : undefined}
                        aria-describedby={fieldState.error ? gameIdErrorId : undefined}
                      />
                      {fieldState.error && (
                        <span id={gameIdErrorId} role="alert" className="text-xs text-danger">
                          {fieldState.error.message}
                        </span>
                      )}
                    </div>
                  )}
                />
              )}
            </div>
          </section>

          <section className={GROUP_CLASS}>
            <h3 className={GROUP_TITLE_CLASS}>{t('ReportUserDialog.categoryGroup')}</h3>
            <div className="grid grid-cols-[max-content_1fr] items-center gap-x-3">
              <label htmlFor="report-user-category">{t('ReportUserDialog.category')}</label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    id="report-user-category"
                    className={INPUT_CLASS}
                    title={t(`ReportUserDialog.categoryTooltip.${field.value}`)}
                    disabled={busy}
                  >
                    {REPORT_CATEGORIES.map((key) => (
                      <option key={key} value={key} title={t(`ReportUserDialog.categoryTooltip.${key}`)}>
                        {t(`ReportUserDialog.categoryLabel.${key}`)}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>
          </section>

          <section className={GROUP_CLASS}>
            <label htmlFor="report-user-description" className={GROUP_TITLE_CLASS}>
              {t('ReportUserDialog.descriptionGroup')}
            </label>
            <Controller
              name="description"
              control={control}
              render={({ field, fieldState }) => (
                <>
                  <textarea
                    {...field}
                    id="report-user-description"
                    rows={5}
                    className={INPUT_CLASS}
                    placeholder={t('ReportUserDialog.descriptionPlaceholder')}
                    disabled={busy}
                    aria-invalid={fieldState.error ? true : undefined}
                    aria-describedby={fieldState.error ? descriptionErrorId : undefined}
                  />
                  {fieldState.error && (
                    <span id={descriptionErrorId} role="alert" className="text-xs text-danger">
                      {fieldState.error.message}
                    </span>
                  )}
                </>
              )}
            />
          </section>

          <section className={GROUP_CLASS}>
            <label htmlFor="report-user-chat-log" className={GROUP_TITLE_CLASS}>
              {t('ReportUserDialog.chatGroup')}
            </label>
            <textarea
              id="report-user-chat-log"
              readOnly
              rows={4}
              value={chatLog}
              placeholder={t('ReportUserDialog.chatEmpty')}
              className={`${INPUT_CLASS} font-mono text-xs`}
            />
            <p className="text-xs text-text-muted">{t('ReportUserDialog.chatNote')}</p>
          </section>

          {failure && <p role="alert" className="text-sm text-danger">{failure}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
            >
              {t('ReportUserDialog.cancel')}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ? t('ReportUserDialog.submitting') : t('ReportUserDialog.submit')}
            </button>
          </div>
        </form>
      </DialogShell>

      <ConfirmDialog
        isOpen={submitState === 'confirming'}
        title={t('ReportUserDialog.confirmTitle')}
        message={t('ReportUserDialog.confirmMessage', {
          user: userName,
          category: t(`ReportUserDialog.categoryLabel.${category}`),
        })}
        confirmLabel={t('ReportUserDialog.confirmYes')}
        cancelLabel={t('ReportUserDialog.confirmNo')}
        onConfirm={send}
        onCancel={() => setSubmitState('editing')}
      />

      <AlertDialog
        isOpen={submitState === 'submitted'}
        severity="info"
        title={t('ReportUserDialog.submittedTitle')}
        message={t('ReportUserDialog.submittedMessage')}
        onDismiss={onClose}
      />
    </>
  );
}
