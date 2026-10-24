import type { Response_WarnList } from '@cockatrice/sockatrice/generated';

import type { WarningOption } from './WarnUserDialog';

export function toWarningOptions(warnList: Response_WarnList | undefined): WarningOption[] {
  if (!warnList) {
    return [];
  }
  return warnList.warning.map((warning, i) => ({
    warning: warning.trim(),
    startingIl: i < warnList.warningIl.length ? warnList.warningIl[i] : 1,
  }));
}
