import { memo } from 'react';
import { styled } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { useTranslation } from 'react-i18next';

import { useGameDialogsContext } from '../../components/ui/GameDialogsContext';
import {
  MAX_ANNOTATION_LEN,
  MAX_NAME_LEN,
  MAX_PT_LEN,
  useCreateTokenDialog,
} from './useCreateTokenDialog';

import './CreateTokenDialog.css';

const PREFIX = 'CreateTokenDialog';

const classes = {
  root: `${PREFIX}-root`,
};

const StyledDialog = styled(Dialog)(({ theme }) => ({
  [`&.${classes.root}`]: {
    '& .dialog-title__wrapper': {
      borderColor: theme.palette.divider,
    },
  },
}));

export interface CreateTokenSubmit {
  name: string;
  color: string;
  pt: string;
  annotation: string;
  destroyOnZoneChange: boolean;
  faceDown: boolean;
  providerId?: string;
}

const COLOR_OPTIONS = [
  { value: 'w', key: 'w' },
  { value: 'u', key: 'u' },
  { value: 'b', key: 'b' },
  { value: 'r', key: 'r' },
  { value: 'g', key: 'g' },
  { value: 'm', key: 'm' },
  { value: '', key: 'c' },
] as const;

function CreateTokenDialog() {
  const { t } = useTranslation();
  const {
    createTokenOpen: isOpen,
    createTokenInitial: initial,
    handleCreateTokenSubmit: onSubmit,
    closeCreateToken: onCancel,
  } = useGameDialogsContext();
  const {
    name,
    color,
    pt,
    annotation,
    destroyOnZoneChange,
    faceDown,
    error,
    search,
    filteredTokens,
    selectedTokenName,
    setSearch,
    selectPredefinedToken,
    handleNameChange,
    setColor,
    setPT,
    setAnnotation,
    setDestroyOnZoneChange,
    setFaceDown,
    handleSubmit,
  } = useCreateTokenDialog({ isOpen, onSubmit, initial });

  return (
    <StyledDialog
      className={'CreateTokenDialog ' + classes.root}
      open={isOpen}
      onClose={onCancel}
      maxWidth={false}
    >
      <DialogTitle className="dialog-title">
        <div className="dialog-title__wrapper">
          {t('CreateTokenDialog.title')}
        </div>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent className="dialog-content create-token-dialog__body">
          <div className="create-token-dialog__chooser">
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              label={t('CreateTokenDialog.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{ htmlInput: { 'aria-label': t('CreateTokenDialog.search') } }}
            />
            <div className="create-token-dialog__chooser-list scrollable">
              {filteredTokens.length === 0 ? (
                <div className="create-token-dialog__chooser-empty">
                  {t('CreateTokenDialog.noTokens')}
                </div>
              ) : (
                <List dense disablePadding>
                  {filteredTokens.map((token) => {
                    const tokenName = token.name?.value ?? '';
                    return (
                      <ListItemButton
                        key={tokenName}
                        selected={tokenName === selectedTokenName}
                        onClick={() => selectPredefinedToken(token)}
                      >
                        <ListItemText
                          primary={tokenName}
                          secondary={token.prop?.value?.type?.value}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
            </div>
            {selectedTokenName && (
              <div className="create-token-dialog__preview">
                <strong>{selectedTokenName}</strong>
                {pt ? ` — ${pt}` : ''}
              </div>
            )}
          </div>

          <div className="create-token-dialog__form">
            <TextField
              autoFocus
              fullWidth
              variant="outlined"
              size="small"
              label={t('EditTokens.label.name')}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              error={error != null}
              helperText={error ?? ''}
              disabled={faceDown}
              slotProps={{ htmlInput: { 'aria-label': t('EditTokens.label.name'), maxLength: MAX_NAME_LEN } }}
            />
            <FormControl fullWidth size="small" variant="outlined" disabled={faceDown}>
              <InputLabel id="create-token-color-label">{t('EditTokens.label.color')}</InputLabel>
              <Select
                labelId="create-token-color-label"
                label={t('EditTokens.label.color')}
                value={color}
                onChange={(e) => setColor(e.target.value)}
                slotProps={{ input: { 'aria-label': t('EditTokens.label.color') } }}
              >
                {COLOR_OPTIONS.map((opt) => (
                  <MenuItem key={opt.key} value={opt.value}>
                    {t(`EditTokens.color.${opt.key}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              label={t('EditTokens.label.pt')}
              placeholder={t('CreateTokenDialog.placeholder.powerToughness')}
              value={pt}
              onChange={(e) => setPT(e.target.value.slice(0, MAX_PT_LEN))}
              disabled={faceDown}
              slotProps={{ htmlInput: { 'aria-label': t('EditTokens.label.pt'), maxLength: MAX_PT_LEN } }}
            />
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              label={t('EditTokens.label.annotation')}
              value={annotation}
              onChange={(e) => setAnnotation(e.target.value.slice(0, MAX_ANNOTATION_LEN))}
              slotProps={{ htmlInput: { 'aria-label': t('EditTokens.label.annotation'), maxLength: MAX_ANNOTATION_LEN } }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={destroyOnZoneChange}
                  onChange={(e) => setDestroyOnZoneChange(e.target.checked)}
                  slotProps={{ input: { 'aria-label': t('CreateTokenDialog.destroyOnZoneChange') } }}
                />
              }
              label={t('CreateTokenDialog.destroyOnZoneChange')}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={faceDown}
                  onChange={(e) => setFaceDown(e.target.checked)}
                  slotProps={{ input: { 'aria-label': t('CreateTokenDialog.faceDown') } }}
                />
              }
              label={t('CreateTokenDialog.faceDown')}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onCancel}>{t('Common.action.cancel')}</Button>
          <Button type="submit" variant="contained" color="primary">{t('Common.action.create')}</Button>
        </DialogActions>
      </form>
    </StyledDialog>
  );
}

export default memo(CreateTokenDialog);
