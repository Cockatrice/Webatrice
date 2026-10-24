import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { Bug, Film, Shuffle, UserPlus } from 'lucide-react';

import { Button, IconButton, LanguageDropdown } from '@app/components';
import { DebugLogDialog } from '@app/dialogs';
import { useDocumentTitle, useVersion } from '@app/hooks';
import { Images } from '@app/images';
import { Layout } from '@app/feature-wrappers/layout';
import { useKnownHosts } from '@app/feature-widgets/known-hosts';
import { RouteEnum } from '@app/types';
import { cx } from '@app/utils';
import RegistrationDialog from './dialogs/RegistrationDialog/RegistrationDialog';
import RequestPasswordResetDialog from './dialogs/RequestPasswordResetDialog/RequestPasswordResetDialog';
import ResetPasswordDialog from './dialogs/ResetPasswordDialog/ResetPasswordDialog';
import AccountActivationDialog from './dialogs/AccountActivationDialog/AccountActivationDialog';
import LoginForm from './forms/LoginForm/LoginForm';
import { useLoginArt, type LoginArt } from './art/useLoginArt';
import { shortVersion } from './shortVersion';
import { useLogin } from './useLogin';
import { useStartupDestination } from './startupDestination';

import './Login.css';

const ACTION_CARD_CLASS = [
  'flex min-w-0 items-center gap-3 rounded-ui-lg border border-border-subtle bg-bg-surface/80 px-4 py-3 text-left',
  'backdrop-blur-sm transition-colors hover:border-accent/60',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
].join(' ');

function ActionCardBody({ icon, title, hint, titleId, hintId }: {
  icon: ReactNode;
  title: string;
  hint: string;
  titleId: string;
  hintId: string;
}) {
  return (
    <>
      {icon}
      <span className="min-w-0">
        <span id={titleId} className="block truncate text-[13.5px] font-semibold text-text-primary">{title}</span>
        <span id={hintId} className="block truncate text-[12px] text-text-muted">{hint}</span>
      </span>
    </>
  );
}

function LoginBackdrop({ art }: { art: LoginArt }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="login-art-fallback absolute inset-0" />
      {art.url && (
        <img
          key={art.name}
          src={art.url}
          alt=""
          referrerPolicy="no-referrer"
          decoding="async"
          onError={art.onError}
          className="absolute inset-y-0 right-0 h-full w-full object-cover object-center lg:w-[78%]"
        />
      )}
      <div className="login-art-dim absolute inset-0" />
      <div className="login-art-floor absolute inset-x-0 bottom-0 h-40" />
    </div>
  );
}

const Login = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('Login.header.title'));
  const {
    description,
    passwordChangeRequired,
    loginFailed,
    isConnected,
    dialogState,
    userToResetPassword,
    submitButtonDisabled,
    handleLogin,
    showDescription,
    handleRegistrationDialogSubmit,
    handleAccountActivationDialogSubmit,
    handleRequestPasswordResetDialogSubmit,
    handleResetPasswordDialogSubmit,
    skipTokenRequest,
    closeRequestPasswordResetDialog,
    openRequestPasswordResetDialog,
    closeResetPasswordDialog,
    closeRegistrationDialog,
    openRegistrationDialog,
    closeActivateAccountDialog,
  } = useLogin();
  const destination = useStartupDestination(isConnected);
  const version = useVersion();
  const knownHosts = useKnownHosts();
  const serverName = knownHosts.value?.selectedHost?.name;
  const art = useLoginArt();
  const [debugLogOpen, setDebugLogOpen] = useState(false);
  const ids = useId();

  return (
    <Layout showNav={false} noHeightLimit={true}>
      <div className="relative h-full overflow-hidden bg-bg-base text-text-primary">
        {isConnected && <Navigate to={destination.to} state={destination.state} />}
        <LoginBackdrop art={art} />

        <div className="relative h-full overflow-y-auto">
          <div
            className={cx(
              'flex min-h-full w-full max-w-[640px] flex-col px-4 pb-6 pt-8',
              'sm:px-12 lg:pb-8 lg:pt-12 xl:px-[88px] [@media(max-height:780px)]:pt-6',
            )}
          >
            <div className="flex items-center gap-3">
              <img src={Images.Logo} alt="" className="h-10 w-10 rounded-ui" />
              <span className="font-display text-[24px] font-semibold tracking-tight text-text-primary">
                {t('Login.header.brand')}
              </span>
            </div>

            <div className="flex flex-1 flex-col justify-center py-6 [@media(max-height:780px)]:py-4">
              <h1
                className={cx(
                  'font-display text-[28px] font-semibold leading-[1.12] text-text-primary sm:text-[34px]',
                  '[@media(max-height:780px)]:text-[28px]',
                )}
              >
                {t('Login.header.headline')}
              </h1>

              <section
                aria-label={t('Login.header.title')}
                className={cx(
                  'relative z-10 mt-7 rounded-ui-lg border border-border-subtle bg-bg-surface/90 p-5 shadow-pop backdrop-blur-sm',
                  '[@media(max-height:780px)]:mt-5',
                )}
              >
                <LoginForm
                  onSubmit={handleLogin}
                  onResetPassword={openRequestPasswordResetDialog}
                  disableSubmitButton={submitButtonDisabled}
                  failed={loginFailed}
                />

                {showDescription() && (
                  <div
                    role="status"
                    className={cx(
                      'mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-ui border px-3 py-2 text-[13px] text-text-primary',
                      loginFailed ? 'border-danger/50 bg-danger/10' : 'border-border-subtle bg-bg-sunken',
                    )}
                  >
                    <span className="min-w-0 flex-1">{description}</span>
                    {passwordChangeRequired && (
                      <Button size="sm" variant="ghost" onClick={openRequestPasswordResetDialog}>
                        {t('Login.status.passwordChangeRequiredAction')}
                      </Button>
                    )}
                  </div>
                )}
              </section>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 [@media(max-height:780px)]:mt-4">
                <button
                  type="button"
                  onClick={openRegistrationDialog}
                  aria-labelledby={`${ids}-register`}
                  aria-describedby={`${ids}-register-hint`}
                  className={ACTION_CARD_CLASS}
                >
                  <ActionCardBody
                    icon={<UserPlus size={18} className="shrink-0 text-accent" aria-hidden />}
                    title={t('Login.action.register')}
                    hint={serverName ? t('Login.action.registerOn', { server: serverName }) : t('Login.action.registerHint')}
                    titleId={`${ids}-register`}
                    hintId={`${ids}-register-hint`}
                  />
                </button>
                <Link
                  to={RouteEnum.REPLAYS}
                  aria-labelledby={`${ids}-replay`}
                  aria-describedby={`${ids}-replay-hint`}
                  className={ACTION_CARD_CLASS}
                >
                  <ActionCardBody
                    icon={<Film size={18} className="shrink-0 text-accent" aria-hidden />}
                    title={t('Login.action.watchReplay')}
                    hint={t('Login.action.watchReplayHint')}
                    titleId={`${ids}-replay`}
                    hintId={`${ids}-replay-hint`}
                  />
                </Link>
              </div>
            </div>

            <footer className="flex flex-wrap items-center gap-2 text-[12px] text-text-muted">
              <LanguageDropdown />
              <Button
                size="sm"
                variant="quiet"
                icon={<Bug size={13} aria-hidden />}
                onClick={() => setDebugLogOpen(true)}
              >
                {t('Login.footer.debugLog')}
              </Button>
              {version && (
                <span className="ml-auto tabular-nums" title={version}>
                  {t('Login.footer.version', { version: shortVersion(version) })}
                </span>
              )}
            </footer>
          </div>
        </div>

        {art.enabled && (
          <div
            className={cx(
              'absolute bottom-8 right-10 hidden items-center gap-2 rounded-full border border-border-subtle',
              'bg-bg-surface/80 py-1 pl-3 pr-1 text-[12px] text-text-secondary backdrop-blur-sm lg:flex',
            )}
          >
            {!art.failed && (
              <span>
                {t('Login.art.label')} <span className="font-medium text-text-primary">{art.name}</span>
              </span>
            )}
            <IconButton size="sm" label={t('Login.art.shuffle')} onClick={art.shuffle}>
              <Shuffle size={14} aria-hidden />
            </IconButton>
          </div>
        )}

        <DebugLogDialog isOpen={debugLogOpen} onClose={() => setDebugLogOpen(false)} />

        <RegistrationDialog
          isOpen={dialogState.registrationDialog}
          onSubmit={handleRegistrationDialogSubmit}
          handleClose={closeRegistrationDialog}
        />

        <RequestPasswordResetDialog
          isOpen={dialogState.passwordResetRequestDialog}
          onSubmit={handleRequestPasswordResetDialogSubmit}
          handleClose={closeRequestPasswordResetDialog}
          skipTokenRequest={skipTokenRequest}
        />

        <ResetPasswordDialog
          isOpen={dialogState.resetPasswordDialog}
          onSubmit={handleResetPasswordDialogSubmit}
          handleClose={closeResetPasswordDialog}
          userName={userToResetPassword}
        />

        <AccountActivationDialog
          isOpen={dialogState.activationDialog}
          onSubmit={handleAccountActivationDialogSubmit}
          handleClose={closeActivateAccountDialog}
        />
      </div>
    </Layout>
  );
};

export default Login;
