import { styled } from '@mui/material/styles';
import { useTranslation, Trans } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import Typography from '@mui/material/Typography';

import { Layout } from '@app/feature-core';
import { Images } from '@app/images';
import { server } from 'datatrice';
import { RouteEnum } from '@app/types';
import { useAppSelector } from '@app/store';

import './Initialize.css';

const PREFIX = 'Initialize';

const classes = {
  root: `${PREFIX}-root`
};

const Root = styled('div')(({ theme }) => ({
  [`&.${classes.root}`]: {
    '& .Initialize-graphics': {
      color: theme.palette.primary.contrastText,
    },

    '& .Initialize-graphics__bar': {
      backgroundColor: theme.palette.primary.contrastText,
    },
  }
}));

const Initialize = () => {
  const initialized = useAppSelector(state => server.Selectors.getInitialized(state));
  const { t } = useTranslation();

  return initialized
    ? <Navigate to={RouteEnum.LOGIN} />
    : (
      <Layout>
        <Root className={'Initialize ' + classes.root}>
          <div className='Initialize-content'>
            <img src={Images.Logo} alt="logo" />
            <Typography variant="subtitle1" className='subtitle'>{ t('Initialize.title') }</Typography>
            <Trans i18nKey="Initialize.subtitle">
              <Typography variant="subtitle2"></Typography>
              <Typography variant="subtitle2"></Typography>
            </Trans>
          </div>

          <div className="Initialize-graphics">
            <div className="topLeft Initialize-graphics__square" />
            <div className="topRight Initialize-graphics__square" />
            <div className="bottomRight Initialize-graphics__square" />
            <div className="bottomLeft Initialize-graphics__square" />
            <div className="topBar Initialize-graphics__bar" />
            <div className="bottomBar Initialize-graphics__bar" />
          </div>
        </Root>
      </Layout>
    );
}

export default Initialize;
