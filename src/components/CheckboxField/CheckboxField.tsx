import type { FocusEventHandler } from 'react';
import Checkbox, { CheckboxProps } from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import type { FieldRenderProps } from 'react-final-form';

type CheckboxFieldProps = FieldRenderProps<boolean, HTMLInputElement> & {
  label?: string;
} & Omit<CheckboxProps, 'checked' | 'onChange' | 'onBlur' | 'onFocus' | 'name' | 'value'>;

const CheckboxField = ({ input, meta: _meta, label, ...args }: CheckboxFieldProps) => {
  const { value, onChange, onBlur, onFocus, name } = input;

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
          // MUI Checkbox renders a <button>; final-form's onBlur/onFocus are
          // typed for <input>. Same event shape at runtime — cast through.
          onBlur={onBlur as unknown as FocusEventHandler<HTMLButtonElement>}
          onFocus={onFocus as unknown as FocusEventHandler<HTMLButtonElement>}
          color="primary"
        />
      }
    />
  );
};

export default CheckboxField;
