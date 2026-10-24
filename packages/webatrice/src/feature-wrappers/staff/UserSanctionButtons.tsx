import { useTranslation } from 'react-i18next';
import { Ban, TriangleAlert } from 'lucide-react';

import { Button } from '@app/components';

import { useUserSanctions } from './useUserSanctions';

export default function UserSanctionButtons({ userName }: { userName: string }) {
  const { t } = useTranslation();
  const sanctions = useUserSanctions(userName);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" icon={<TriangleAlert size={13} aria-hidden />} disabled={!sanctions.canWarn} onClick={sanctions.warn}>
        {t('Staff.sanctions.warn')}
      </Button>
      <Button size="sm" variant="danger" icon={<Ban size={13} aria-hidden />} disabled={!sanctions.canBan} onClick={sanctions.ban}>
        {t('Staff.sanctions.ban')}
      </Button>
      <span className="text-[11px] text-text-muted">
        {sanctions.canWarn || sanctions.canBan ? t('Staff.sanctions.hint') : t('Staff.sanctions.lockedHint')}
      </span>
    </div>
  );
}
