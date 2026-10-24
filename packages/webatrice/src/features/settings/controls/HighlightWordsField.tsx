import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePreference, useSettings } from '@app/hooks';

import type { CustomControlProps } from '../registry';
import { textField } from './fields';

export default function HighlightWordsField({ id, labelId, describedBy, disabled }: CustomControlProps) {
  const { t } = useTranslation();
  const settings = useSettings();
  const stored = usePreference('chatHighlightWords');
  const [words, setWords] = useState(stored);

  useEffect(() => {
    setWords(stored);
  }, [stored]);

  return (
    <input
      id={id}
      type="text"
      className={textField}
      value={words}
      placeholder={t('SettingsChat.highlightWords.placeholder')}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      disabled={disabled}
      onChange={(e) => {
        setWords(e.target.value);
        void settings.update({ chatHighlightWords: e.target.value });
      }}
    />
  );
}
