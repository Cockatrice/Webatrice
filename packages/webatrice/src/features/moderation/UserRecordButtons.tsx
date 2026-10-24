import { useTranslation } from 'react-i18next';
import { History, NotebookPen, ShieldX } from 'lucide-react';

import { Button } from '@app/components';
import { useModerationMenu, type ModerationAction } from '@app/feature-widgets/moderation';
import { menuAllows, sectionLabelClass } from '@app/feature-wrappers/staff';

type RecordAction = Extract<ModerationAction, 'warnHistory' | 'banHistory' | 'adminNotes'>;

const RECORD_LABEL_KEYS: Record<RecordAction, string> = {
  warnHistory: 'ModerationPage.recordAction.warnHistory',
  banHistory: 'ModerationPage.recordAction.banHistory',
  adminNotes: 'ModerationPage.recordAction.adminNotes',
};

const RECORDS: readonly [RecordAction, typeof History][] = [
  ['warnHistory', History],
  ['banHistory', ShieldX],
  ['adminNotes', NotebookPen],
];

export default function UserRecordButtons({ userName }: { userName: string }) {
  const { t } = useTranslation();
  const { groups, open } = useModerationMenu(userName);
  return (
    <div className="flex flex-col gap-1.5">
      <span className={sectionLabelClass}>{t('ModerationPage.records')}</span>
      <div className="flex flex-wrap gap-2">
        {RECORDS.map(([action, Icon]) => (
          <Button
            key={action}
            size="sm"
            icon={<Icon size={13} aria-hidden />}
            disabled={!menuAllows(groups, action)}
            onClick={() => open(action)}
          >
            {t(RECORD_LABEL_KEYS[action])}
          </Button>
        ))}
      </div>
    </div>
  );
}
