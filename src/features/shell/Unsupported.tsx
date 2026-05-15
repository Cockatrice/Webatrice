import { useTranslation } from 'react-i18next';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { Layout } from '@app/feature-wrappers/layout';

import './Unsupported.css';

const Unsupported = () => {
  const { t } = useTranslation();

  return (
    <Layout className='Unsupported'>
      <Paper className='Unsupported-paper'>
        <div className='Unsupported-paper__header'>
          <Typography variant="h1">{ t('Unsupported.title') }</Typography>
          <Typography variant="subtitle1">{ t('Unsupported.subtitle1') }</Typography>
        </div>

        <Typography variant="subtitle2">{ t('Unsupported.subtitle2') }</Typography>
      </Paper>
    </Layout>
  );
};

export default Unsupported;
