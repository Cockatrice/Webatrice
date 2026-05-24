import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { Select, MenuItem, SelectChangeEvent } from '@mui/material';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import PortableWifiOffIcon from '@mui/icons-material/PortableWifiOff';
import InputLabel from '@mui/material/InputLabel';
import Check from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import EditRoundedIcon from '@mui/icons-material/Edit';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';

import { HostDTO } from '@app/services';
import { getHostPort } from '@app/utils';

import KnownHostDialog from './KnownHostDialog';
import { TestConnection, useKnownHostsComponent } from './useKnownHostsComponent';

import './KnownHosts.css';

const PREFIX = 'KnownHosts';

const classes = {
  root: `${PREFIX}-root`,
};

const Root = styled('div')(({ theme }) => ({
  [`&.${classes.root}`]: {
    '& .KnownHosts-error': {
      color: theme.palette.error.main,
    },

    '& .KnownHosts-item': {
      [`& .${TestConnection.TESTING}`]: {
        color: theme.palette.warning.main,
      },
      [`& .${TestConnection.FAILED}`]: {
        color: theme.palette.error.main,
      },
      [`& .${TestConnection.SUCCESS}`]: {
        color: theme.palette.success.main,
      },
    },
  },
}));

interface KnownHostsProps {
  value: HostDTO | undefined;
  onChange: (host: HostDTO | undefined) => void;
  error?: string;
  touched?: boolean;
  disabled?: boolean;
}

const KnownHosts = ({ onChange, error, touched, disabled }: KnownHostsProps) => {

  const { t } = useTranslation();
  const {
    hosts,
    selectedHost,
    testConnectionStatus,
    dialogState,
    onPick,
    openAddKnownHostDialog,
    openEditKnownHostDialog,
    closeKnownHostDialog,
    handleDialogRemove,
    handleDialogSubmit,
  } = useKnownHostsComponent({ onChange });

  const selectedId = selectedHost?.id ?? '';

  const handleSelectChange = (event: SelectChangeEvent<number | ''>) => {
    const value = event.target.value;
    if (typeof value === 'number') {
      void onPick(value);
    }
  };

  return (
    <Root className={`KnownHosts ${classes.root}`}>
      <FormControl className="KnownHosts-form" size="small" variant="outlined">
        {touched && error && (
          <div className="KnownHosts-validation">
            <div className="KnownHosts-error">
              {error}
              <ErrorOutlinedIcon style={{ fontSize: 'small', fontWeight: 'bold' }} />
            </div>
          </div>
        )}

        <InputLabel id="KnownHosts-label">{t('KnownHosts.label')}</InputLabel>
        <Select
          id="KnownHosts-select"
          labelId="KnownHosts-label"
          label="Host"
          margin="dense"
          name="host"
          value={selectedId}
          fullWidth
          onChange={handleSelectChange}
          disabled={disabled}
        >
          <Button onClick={openAddKnownHostDialog}>
            <span>{t('KnownHosts.add')}</span>
            <AddIcon fontSize="small" color="primary" />
          </Button>

          {hosts.map((host) => {
            const hostPort = getHostPort(host);

            return (
              <MenuItem value={host.id} key={host.id}>
                <div className="KnownHosts-item">
                  <div className="KnownHosts-item__wrapper">
                    <div className={`KnownHosts-item__status ${testConnectionStatus ?? ''}`}>
                      {testConnectionStatus === TestConnection.FAILED ? (
                        <PortableWifiOffIcon fontSize="small" />
                      ) : (
                        <WifiTetheringIcon fontSize="small" />
                      )}
                    </div>

                    <div className="KnownHosts-item__label">
                      <Check />
                      <span>
                        {host.name} ({hostPort.host}:{hostPort.port})
                      </span>
                    </div>
                  </div>

                  {host.editable && (
                    <IconButton
                      className="KnownHosts-item__edit"
                      size="small"
                      color="primary"
                      onClick={() => {
                        openEditKnownHostDialog(host);
                      }}
                    >
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                  )}
                </div>
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>

      <KnownHostDialog
        isOpen={dialogState.open}
        host={dialogState.edit ?? undefined}
        onRemove={handleDialogRemove}
        onSubmit={handleDialogSubmit}
        handleClose={closeKnownHostDialog}
      />
    </Root>
  );
};

export default KnownHosts;
