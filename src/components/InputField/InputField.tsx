import { styled } from '@mui/material/styles';
import TextField, { TextFieldProps } from '@mui/material/TextField';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import type { FieldRenderProps } from 'react-final-form';

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

type InputFieldProps =
  FieldRenderProps<string, HTMLInputElement> &
  Omit<TextFieldProps, 'value' | 'onChange' | 'onBlur' | 'onFocus' | 'name'>;

const InputField = ({ input, meta, ...args }: InputFieldProps) => {
  const { touched, error } = meta;

  return (
    <Root className={`InputField ${classes.root}`}>
      {touched && error && (
        <div className="InputField-validation">
          <div className="InputField-error">
            {error}
            <ErrorOutlinedIcon style={{ fontSize: 'small', fontWeight: 'bold' }} />
          </div>
        </div>
      )}

      <TextField
        autoComplete="off"
        {...input}
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
