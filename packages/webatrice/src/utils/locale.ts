/** Convert a Cockatrice/Transifex-style locale code (underscore, e.g. `pt_BR`,
 *  `en_US`) to a BCP-47 tag (hyphen, `pt-BR`) for JS `Intl` APIs, which throw
 *  `RangeError: Invalid language tag` on underscores. The underscore form stays
 *  canonical everywhere else (Language enum, localStorage `i18nextLng`, the
 *  `public/locales/<code>` directory names, Transifex). */
export const toBcp47 = (lng: string | undefined): string => (lng ?? '').replace(/_/g, '-');
