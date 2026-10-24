import { ZoneName } from '@cockatrice/sockatrice';

import type { ZoneViewTarget } from '../../hooks/dialogs/gameDialogs.types';

export function isOrderedView(view: ZoneViewTarget): boolean {
  return view.zoneName === ZoneName.DECK && (view.numberCards ?? -1) !== -1;
}

export function offersShuffleOnClose(view: ZoneViewTarget): boolean {
  return view.zoneName === ZoneName.DECK && !isOrderedView(view);
}
