import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import { AuthGuard } from '@app/components';
import { ShortcutsTab } from '@app/feature-widgets/shortcuts';
import { Layout } from '@app/feature-wrappers/layout';

import './Settings.css';

interface TabPanelProps {
  children?: ReactNode;
  value: number;
  index: number;
}

const a11yProps = (index: number): { id: string; 'aria-controls': string } => ({
  id: `settings-tab-${index}`,
  'aria-controls': `settings-tabpanel-${index}`,
});

const TabPanel = ({ children, value, index }: TabPanelProps) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`settings-tabpanel-${index}`}
    aria-labelledby={`settings-tab-${index}`}
    className="settings__panel scrollable"
  >
    {value === index && <Box>{children}</Box>}
  </div>
);

const Settings = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  return (
    <Layout className="settings">
      <AuthGuard />
      <AppBar position="static">
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          textColor="inherit"
          indicatorColor="secondary"
          aria-label={t('Settings.title')}
        >
          <Tab label={t('Settings.tab.shortcuts')} {...a11yProps(0)} />
        </Tabs>
      </AppBar>
      <TabPanel value={tab} index={0}>
        <ShortcutsTab />
      </TabPanel>
    </Layout>
  );
};

export default Settings;
