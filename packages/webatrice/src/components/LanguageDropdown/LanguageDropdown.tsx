import { useTranslation } from 'react-i18next';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';

import { useLanguagePreference } from '@app/hooks';
import { Images } from '@app/images';
import { Language, LanguageCountry, LanguageNative } from '@app/types';
import './LanguageDropdown.css';

const LanguageDropdown = () => {
  const { t } = useTranslation();
  const { current, choose } = useLanguagePreference();

  const onLanguageChange = (event: SelectChangeEvent) => {
    const next = event.target.value as Language;
    if (next !== current) {
      void choose(next);
    }
  };

  return (
    <FormControl size="small" variant="outlined" className="LanguageDropdown">
      <Select
        id="LanguageDropdown-select"
        margin="dense"
        value={current}
        fullWidth
        onChange={onLanguageChange}
        inputProps={{ 'aria-label': t('Common.languagePicker') }}
      >
        {Object.values(Language).map((lang) => {
          const country = LanguageCountry[lang];
          const nativeName = LanguageNative[lang];
          const translatedName = t(`Common.languages.${lang}`);

          return (
            <MenuItem value={lang} key={lang}>
              <div className="LanguageDropdown-item">
                {country ? (
                  <img className="LanguageDropdown-item__image" src={Images.Countries[country]} alt="" />
                ) : (
                  <span className="LanguageDropdown-item__code">{lang}</span>
                )}
                <span className="LanguageDropdown-item__label">
                  {nativeName} {nativeName !== translatedName && <>({translatedName})</>}
                </span>
              </div>
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
};

export default LanguageDropdown;
