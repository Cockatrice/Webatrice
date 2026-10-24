import type { FocusEvent } from 'react';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { useTranslation } from 'react-i18next';

import { useLocaleSort } from '@app/hooks';
import { Images } from '@app/images';
import { countryCodes } from '@app/types';

import './CountryDropdown.css';

interface CountryDropdownProps {
  value: string | undefined;
  onChange: (e: SelectChangeEvent<string>) => void;
  onBlur?: (e: FocusEvent<HTMLElement>) => void;
  name?: string;
}

const CountryDropdown = ({ value, onChange, onBlur, name }: CountryDropdownProps) => {
  const { t } = useTranslation();
  const currentValue = value ?? '';

  const translateCountry = (country: string) => t(`Common.countries.${country}`);
  const sortedCountries = useLocaleSort(countryCodes, translateCountry);

  return (
    <FormControl size="small" variant="outlined" className="CountryDropdown">
      <InputLabel id="CountryDropdown-label">{t('Common.label.country')}</InputLabel>
      <Select
        id="CountryDropdown-select"
        labelId="CountryDropdown-label"
        label={t('Common.label.country')}
        margin="dense"
        fullWidth
        name={name}
        value={currentValue}
        onChange={onChange}
        onBlur={onBlur}
      >
        <MenuItem value="" key="none">
          <div className="CountryDropdown-item">
            <span className="CountryDropdown-item__label">{t('Common.label.none')}</span>
          </div>
        </MenuItem>

        {sortedCountries.map(country => (
          <MenuItem value={country} key={country}>
            <div className="CountryDropdown-item">
              <img className="CountryDropdown-item__image" src={Images.Countries[country.toLowerCase()]} alt="" />
              <span className="CountryDropdown-item__label">{translateCountry(country)}</span>
            </div>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default CountryDropdown;
