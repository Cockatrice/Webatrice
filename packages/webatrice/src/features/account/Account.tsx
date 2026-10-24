import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import Button from '@mui/material/Button';
import ListItemButton from '@mui/material/ListItemButton';
import Paper from '@mui/material/Paper';

import { server, ServerCapability } from '@cockatrice/datatrice';
import { UserDisplay, VirtualList, AuthGuard, LanguageDropdown } from '@app/components';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';
import { Layout } from '@app/feature-wrappers/layout';

import AddUserForm from './AddUserForm';
import { ChangeAvatarDialog, ChangePasswordDialog, EditUserDialog } from './dialogs';
import { useAccount } from './useAccount';
import { formatAccountAge, formatUserLevel } from '@app/utils';

import './Account.css';

type AccountDialog = 'edit' | 'password' | 'avatar';

const Account = () => {
  const { t, i18n } = useTranslation();
  const [openDialog, setOpenDialog] = useState<AccountDialog | null>(null);
  const closeDialog = () => setOpenDialog(null);
  const {
    buddyList,
    ignoreList,
    serverName,
    serverVersion,
    user,
    avatarUrl,
    handleAddToBuddies,
    handleAddToIgnore,
    handleDisconnect,
  } = useAccount();
  const { country, realName, name, userLevel, accountageSecs, privlevel } = user || {};
  const navigate = useNavigate();
  const reportsSupported = useAppSelector((state) => server.Selectors.supports(state, ServerCapability.REPORTS));

  return (
    <Layout className="account">
      <AuthGuard />
      <div className="account-column">
        <Paper className="account-list">
          <div>
            {t('Account.buddies.online', { total: buddyList.length })}
          </div>
          <VirtualList
            items={buddyList.map(user => (
              <ListItemButton key={user.name} dense>
                <UserDisplay user={user} />
              </ListItemButton>
            ))}
          />
          <div style={{ borderTop: '1px solid' }}>
            <AddUserForm label={t('Account.buddies.add')} onSubmit={handleAddToBuddies} />
          </div>
        </Paper>
      </div>
      <div className="account-column">
        <Paper className="account-list scrollable">
          <div>
            {t('Account.ignored.online', { total: ignoreList.length })}
          </div>
          <VirtualList
            items={ignoreList.map(user => (
              <ListItemButton key={user.name} dense>
                <UserDisplay user={user} />
              </ListItemButton>
            ))}
          />
          <div style={{ borderTop: '1px solid' }}>
            <AddUserForm label={t('Account.ignored.add')} onSubmit={handleAddToIgnore} />
          </div>
        </Paper>
      </div>
      <div className="account-column scrollable">
        <Paper className="account-details" style={{ margin: '0 0 5px 0' }}>
          {avatarUrl && <img src={avatarUrl} alt={name} />}
          <p><strong>{name}</strong></p>
          <p>{t('Account.details.location', { country: country?.toUpperCase() ?? '' })}</p>
          <p>{t('Account.details.userLevel', { userLevel: user ? formatUserLevel(t, userLevel, privlevel) : '' })}</p>
          <p>{t('Account.details.accountAge', {
            accountAge: user ? formatAccountAge(t, accountageSecs, userLevel, i18n.language) : '',
          })}</p>
          <p>{t('Account.details.realName', { realName: realName ?? '' })}</p>
          <div className="account-details__actions">
            <Button size="small" color="primary" variant="contained" onClick={() => setOpenDialog('edit')}>
              {t('Account.action.edit')}
            </Button>
            <Button size="small" color="primary" variant="contained" onClick={() => setOpenDialog('password')}>
              {t('Account.action.changePassword')}
            </Button>
            <Button size="small" color="primary" variant="contained" onClick={() => setOpenDialog('avatar')}>
              {t('Account.action.changeAvatar')}
            </Button>
          </div>
          <EditUserDialog isOpen={openDialog === 'edit'} handleClose={closeDialog} />
          <ChangePasswordDialog isOpen={openDialog === 'password'} handleClose={closeDialog} />
          <ChangeAvatarDialog isOpen={openDialog === 'avatar'} handleClose={closeDialog} />
          {reportsSupported && (
            <Button size="small" color="primary" variant="outlined" onClick={() => navigate(RouteEnum.MY_REPORTS)}>
              {t('Reports.mine.title')}
            </Button>
          )}

        </Paper>
        <Paper className="account-details">
          <p>{t('Account.server.name', { serverName })}</p>
          <p>{t('Account.server.version', { serverVersion })}</p>
          <Button color="primary" variant="contained" onClick={handleDisconnect}>
            {t('Common.disconnect')}
          </Button>

          <div className="account-details__lang">
            <LanguageDropdown />
          </div>
        </Paper>
      </div>
    </Layout>
  );
};

export default Account;
