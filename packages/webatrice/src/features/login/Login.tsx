import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { LanguageDropdown } from '@app/components';
import { useVersion } from '@app/hooks';
import { Images } from '@app/images';
import { Layout } from '@app/feature-wrappers/layout';
import { RouteEnum } from '@app/types';
import RegistrationDialog from './dialogs/RegistrationDialog/RegistrationDialog';
import RequestPasswordResetDialog from './dialogs/RequestPasswordResetDialog/RequestPasswordResetDialog';
import ResetPasswordDialog from './dialogs/ResetPasswordDialog/ResetPasswordDialog';
import AccountActivationDialog from './dialogs/AccountActivationDialog/AccountActivationDialog';
import LoginForm from './forms/LoginForm/LoginForm';
import { useLogin } from './useLogin';

import './Login.css';

// The pre-redo Root was a styled('div') that pulled colors from
// MUI theme.palette (success.light, primary.main, primary.dark,
// background.paper). ThemeProvider has been removed, so those lookups
// silently returned MUI's blue defaults — the source of the bright
// blue login card. Palette is now driven entirely by Login.css using
// our fancy tokens.

const Login = () => {
  const { t } = useTranslation();
  const {
    description,
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
  const version = useVersion();

  return (
    <Layout showNav={false} noHeightLimit={true}>
      <div className="login scrollable">
        {isConnected && <Navigate to={RouteEnum.SERVER} />}

        <div className="login__wrapper">
          <Paper className="login-content">
            <div className="login-content__form">
              <div className="login-content__header">
                <img src={Images.Logo} alt="logo" />
                <span>COCKATRICE</span>
              </div>
              <Typography variant="h1">{t('Login.header.title')}</Typography>
              <Typography variant="subtitle1">{t('Login.header.subtitle')}</Typography>
              <div className="login-form">
                <LoginForm
                  onSubmit={handleLogin}
                  onResetPassword={openRequestPasswordResetDialog}
                  disableSubmitButton={submitButtonDisabled}
                />
              </div>

              {showDescription() && (
                <Paper className="login-content__connectionStatus">
                  {description}
                </Paper>
              )}

              <div className="login-footer">
                <div className="login-footer__register">
                  <span>{t('Login.footer.registerPrompt')}</span>
                  <Button color="primary" onClick={openRegistrationDialog}>{t('Login.footer.registerAction')}</Button>
                </div>
                <Typography variant="subtitle2">
                  {t('Login.footer.credit')} - {new Date().getUTCFullYear()}
                </Typography>

                {version && (
                  <Typography variant="subtitle2">
                    {t('Login.footer.version')}: {version}
                  </Typography>
                )}

                <div className="login-footer__language">
                  <LanguageDropdown />
                </div>
              </div>
            </div>
            <div className="login-content__description">
              <div className="login-content__description-graphics">
                <div className="topLeft login-content__description-square" />
                <div className="topRight login-content__description-square" />
                <div className="bottomRight login-content__description-square" />
                <div className="bottomLeft login-content__description-square" />
                <div className="topBar login-content__description-bar" />
                <div className="bottomBar login-content__description-bar" />
              </div>
              <div className="login-content__description-wrapper">
                <div className="login-content__description-cards">
                  <div className="login-content__description-cards__card leftCard">
                    <div className="login-content__description-cards__card-wrapper">
                      <img src={Images.Faces.face1} alt='Stock Player' />
                      <span>1mrlee</span>
                    </div>
                  </div>
                  <div className="login-content__description-cards__card rightCard">
                    <div className="login-content__description-cards__card-wrapper">
                      <img src={Images.Faces.face2} alt='Stock Player' />
                      <span>CyberX</span>
                    </div>
                  </div>
                  <div className="login-content__description-cards__card topCard">
                    <div className="login-content__description-cards__card-wrapper">
                      <img src={Images.Faces.face3} alt='Stock Player' />
                      <span>Gamer69</span>
                    </div>
                  </div>
                </div>
                <p className="login-content__description-subtitle1">{t('Login.content.subtitle1')}</p>
                <p className="login-content__description-subtitle2">{t('Login.content.subtitle2')}</p>
              </div>
            </div>
          </Paper>
        </div>

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
