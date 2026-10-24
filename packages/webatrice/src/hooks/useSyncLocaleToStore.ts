import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { server } from '@cockatrice/datatrice';

import { useAppDispatch } from '@app/store';
import { toBcp47 } from '@app/utils';

export function useSyncLocaleToStore(): void {
  const { i18n } = useTranslation();
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(server.Actions.setLocale(toBcp47(i18n.language)));
  }, [dispatch, i18n.language]);
}
