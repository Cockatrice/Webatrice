import { bracketToneClass } from '@app/utils';
import { useTranslation } from 'react-i18next';

export default function BracketBadge({ level }: { level: number }) {
  const { t } = useTranslation();
  const tone = bracketToneClass(level);
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-bold tabular-nums shrink-0 ${tone}`}
      title={t('GameLobby.player.bracketTitle', { level })}
    >
      {t('GameLobby.player.bracketBadge', { level })}
    </span>
  );
}
