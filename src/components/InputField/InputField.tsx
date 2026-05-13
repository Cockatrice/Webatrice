import type { ChangeEvent, FocusEvent } from 'react';
import { styled } from '@mui/material/styles';
import TextField, { TextFieldProps } from '@mui/material/TextField';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';

import './InputField.css';

const PREFIX = 'InputField';

const classes = {
  root: `${PREFIX}-root`,
};

const Root = styled('div')(({ theme }) => ({
  [`&.${classes.root}`]: {
    '& .InputField-error': {
      color: theme.palette.error.main,
    },
  },
}));

// Library-agnostic field wrapper. Form layers (react-final-form via the
// `adaptRffField` helper, or react-hook-form via Controller) bind onto
// this prop surface directly.
export interface InputFieldProps extends Omit<TextFieldProps, 'value' | 'onChange' | 'onBlur' | 'onFocus' | 'name' | 'error'> {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  name?: string;
  error?: string;
  touched?: boolean;
}

const InputField = ({ value, onChange, onBlur, onFocus, name, error, touched, ...args }: InputFieldProps) => {
  const showError = touched && error;
  return (
    <Root className={`InputField ${classes.root}`}>
      {showError && (
        <div className="InputField-validation">
          <div className="InputField-error">
            {error}
            <ErrorOutlinedIcon style={{ fontSize: 'small', fontWeight: 'bold' }} />
          </div>
        </div>
      )}

      <TextField
        autoComplete="off"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={onFocus}
        name={name}
        {...args}
        className="rounded"
        variant="outlined"
        margin="dense"
        size="small"
        fullWidth
      />
    </Root>
  );
};

export default InputField;
