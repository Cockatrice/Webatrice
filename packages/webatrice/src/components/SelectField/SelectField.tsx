import type { FocusEvent } from 'react';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';

import './SelectField.css';

export interface SelectFieldOption<V extends string | number = string | number> {
  value: V;
  label: string;
}

interface SelectFieldProps<V extends string | number = string | number> {
  value: V;
  onChange: (e: SelectChangeEvent<V>) => void;
  onBlur?: (e: FocusEvent<HTMLElement>) => void;
  name?: string;
  label: string;
  options: SelectFieldOption<V>[];
}

const SelectField = <V extends string | number = string | number>({
  value,
  onChange,
  onBlur,
  name,
  label,
  options,
}: SelectFieldProps<V>) => {
  const id = `${label}-select-field`;
  const labelId = `${id}-label`;

  return (
    <FormControl variant="outlined" margin="dense" className="select-field">
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        id={id}
        label={label}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
      >
        {options.map(option => (
          <MenuItem value={option.value} key={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default SelectField;
