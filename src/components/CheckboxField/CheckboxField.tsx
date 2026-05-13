import type { ChangeEvent, FocusEventHandler } from 'react';
import Checkbox, { CheckboxProps } from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

export interface CheckboxFieldProps extends Omit<CheckboxProps, 'checked' | 'onChange' | 'onBlur' | 'onFocus' | 'name' | 'value'> {
  value: boolean | undefined;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: unknown) => void;
  onFocus?: (e: unknown) => void;
  name?: string;
  label?: string;
}

const CheckboxField = ({ value, onChange, onBlur, onFocus, name, label, ...args }: CheckboxFieldProps) => {
  return (
    <FormControlLabel
      className="checkbox-field"
      label={label ?? ''}
      control={
        <Checkbox
          {...args}
          className="checkbox-field__box"
          name={name}
          checked={Boolean(value)}
          onChange={onChange}
          // @critical MUI Checkbox renders a <button>; RHF types onBlur/onFocus for <input> — cast
          onBlur={onBlur as FocusEventHandler<HTMLButtonElement> | undefined}
          onFocus={onFocus as FocusEventHandler<HTMLButtonElement> | undefined}
          color="primary"
        />
      }
    />
  );
};

export default CheckboxField;
