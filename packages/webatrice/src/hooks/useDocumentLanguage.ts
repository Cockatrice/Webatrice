import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { toBcp47 } from '@app/utils';

export function useDocumentLanguage(): void {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language) {
      document.documentElement.lang = toBcp47(i18n.language);
    }
  }, [i18n.language]);
}
