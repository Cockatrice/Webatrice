import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { server } from '@cockatrice/datatrice';

import { useAppDispatch } from '@app/store';
import { toBcp47 } from '@app/utils';

/**
 * Mirrors the active i18next language into the datatrice store as a BCP-47 tag
 * (`server.locale`) so the memoized sorted-user/game selectors collate strings
 * in the chosen language. Locale is normalized here — the single place that owns
 * the underscore Cockatrice code -> hyphen BCP-47 conversion — so datatrice
 * receives a ready tag and never sees `pt_BR`. react-i18next re-renders on
 * `languageChanged`, so the effect re-dispatches whenever the language changes.
 */
export function useSyncLocaleToStore(): void {
  const { i18n } = useTranslation();
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(server.Actions.setLocale(toBcp47(i18n.language)));
  }, [dispatch, i18n.language]);
}
