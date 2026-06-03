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
      borderColor: theme.palette.grey[300],
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

const COLOR_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'w', label: 'White' },
  { value: 'u', label: 'Blue' },
  { value: 'b', label: 'Black' },
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
  { value: 'm', label: 'Multicolor' },
  { value: '', label: 'Colorless' },
];

// Self-sources its open state and the submit / cancel handlers from
// GameDialogsContext, so Game renders it propless.
function CreateTokenDialog() {
  const {
    createTokenOpen: isOpen,
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
  } = useCreateTokenDialog({ isOpen, onSubmit });

  return (
    <StyledDialog
      className={'CreateTokenDialog ' + classes.root}
      open={isOpen}
      onClose={onCancel}
      maxWidth={false}
    >
      <DialogTitle className="dialog-title">
        <div className="dialog-title__wrapper">
          Create token
        </div>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent className="dialog-content create-token-dialog__body">
          <div className="create-token-dialog__chooser">
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              label="Search tokens"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{ htmlInput: { 'aria-label': 'Search tokens' } }}
            />
            <div className="create-token-dialog__chooser-list scrollable">
              {filteredTokens.length === 0 ? (
                <div className="create-token-dialog__chooser-empty">
                  No predefined tokens available.
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
              label="Token name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              error={error != null}
              helperText={error ?? ''}
              disabled={faceDown}
              slotProps={{ htmlInput: { 'aria-label': 'Token name', maxLength: MAX_NAME_LEN } }}
            />
            <FormControl fullWidth size="small" variant="outlined" disabled={faceDown}>
              <InputLabel id="create-token-color-label">Color</InputLabel>
              <Select
                labelId="create-token-color-label"
                label="Color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                slotProps={{ input: { 'aria-label': 'Token color' } }}
              >
                {COLOR_OPTIONS.map((opt) => (
                  <MenuItem key={opt.label} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              label="Token power/toughness"
              placeholder="e.g. 3/3"
              value={pt}
              onChange={(e) => setPT(e.target.value.slice(0, MAX_PT_LEN))}
              disabled={faceDown}
              slotProps={{ htmlInput: { 'aria-label': 'Token power/toughness', maxLength: MAX_PT_LEN } }}
            />
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              label="Token annotation"
              value={annotation}
              onChange={(e) => setAnnotation(e.target.value.slice(0, MAX_ANNOTATION_LEN))}
              slotProps={{ htmlInput: { 'aria-label': 'Token annotation', maxLength: MAX_ANNOTATION_LEN } }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={destroyOnZoneChange}
                  onChange={(e) => setDestroyOnZoneChange(e.target.checked)}
                  slotProps={{ input: { 'aria-label': 'Destroy when it leaves the table' } }}
                />
              }
              label="Destroy when it leaves the table"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={faceDown}
                  onChange={(e) => setFaceDown(e.target.checked)}
                  slotProps={{ input: { 'aria-label': 'Create face-down' } }}
                />
              }
              label="Create face-down"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="contained" color="primary">Create</Button>
        </DialogActions>
      </form>
    </StyledDialog>
  );
}

export default memo(CreateTokenDialog);
